from fastapi import APIRouter, Depends, HTTPException, status, Body, Form, File, UploadFile, Request
from fastapi.responses import Response
from typing import Optional
import os
import json
import shutil
import redis.asyncio as redis
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from .. import crud
from ..dependencies import get_current_user, get_redis_client
from ..models import TicketSchema, UpdateTicketSchema, TicketInDB, UserInDB, CommentSchema, ActivityLogSchema, AgentOut, PRIORITY_LEVELS, NotificationSchema, NotificationInDB, CSATSubmitSchema
from .websockets import manager
from ..ai import classify_ticket, generate_suggested_reply

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


import threading
from ..dependencies import user_collection

def _send_email_in_thread(to_email: str, subject: str, html: str, text: str):
    """Send a single email in a background thread (no async, no DB)."""
    from ..tasks import _send_email
    thread = threading.Thread(
        target=_send_email,
        args=(to_email, subject, html, text),
        daemon=True
    )
    thread.start()

async def _dispatch_creation_email(ticket_data: dict, owner_username: str):
    """Gather data from DB in async context, then send email in background thread."""
    try:
        owner = await user_collection.find_one({"username": owner_username})
        if not owner or not owner.get("email"):
            print(f" [EMAIL] No email found for owner '{owner_username}' — skipped.")
            return
        owner_email = owner["email"]
        title = ticket_data.get("title", "Untitled")
        priority = ticket_data.get("priority", "Medium")
        ticket_status = ticket_data.get("status", "Open")
        ticket_id = ticket_data.get("id", "N/A")

        subject = f"Ticket Created: #{ticket_id[:8]} — {title}"
        text = (
            f"Your ticket '{title}' has been created.\n"
            f"Priority: {priority}\n"
            f"Status: {ticket_status}\n"
            f"Ticket ID: {ticket_id}"
        )
        html = f"""
        <h2>Ticket Created</h2>
        <p>Your support ticket has been submitted successfully.</p>
        <ul>
          <li><strong>Title:</strong> {title}</li>
          <li><strong>Priority:</strong> {priority}</li>
          <li><strong>Status:</strong> {ticket_status}</li>
          <li><strong>ID:</strong> {ticket_id}</li>
        </ul>
        """
        _send_email_in_thread(owner_email, subject, html, text)
    except Exception as e:
        print(f" [EMAIL] Failed to dispatch creation email: {e}")

async def _dispatch_update_email(ticket_data: dict, change_summary: str, acting_username: str = None):
    """Gather recipients from DB in async context, then send email in background thread."""
    try:
        recipients = set()
        owner_username = ticket_data.get("owner_username")
        if owner_username:
            owner = await user_collection.find_one({"username": owner_username})
            if owner and owner.get("email"):
                recipients.add(owner["email"])

        assigned_to = ticket_data.get("assigned_to")
        if assigned_to:
            agent = await user_collection.find_one({"username": assigned_to})
            if agent and agent.get("email"):
                recipients.add(agent["email"])

        if acting_username and acting_username != owner_username and acting_username != assigned_to:
            actor = await user_collection.find_one({"username": acting_username})
            if actor and actor.get("email"):
                recipients.add(actor["email"])

        if not recipients:
            print(f" [EMAIL] No recipients for update email — skipped.")
            return

        title = ticket_data.get("title", "Untitled")
        ticket_status = ticket_data.get("status", "Open")
        priority = ticket_data.get("priority", "Medium")
        ticket_id = ticket_data.get("id", "N/A")

        subject = f"Ticket Updated: #{ticket_id[:8]} — {title}"
        text = f"Ticket '{title}' was updated.\n\nChanges:\n{change_summary}\n\nCurrent status: {ticket_status}"
        html = f"""
        <h2>Ticket Updated</h2>
        <p><strong>{title}</strong></p>
        <p>{change_summary}</p>
        <p>Current status: <strong>{ticket_status}</strong></p>
        <p>Priority: <strong>{priority}</strong></p>
        """
        for email in recipients:
            _send_email_in_thread(email, subject, html, text)
    except Exception as e:
        print(f" [EMAIL] Failed to dispatch update email: {e}")


async def invalidate_all_tickets_cache(redis_client_instance: Optional[redis.Redis]):
    if redis_client_instance:
        await redis_client_instance.flushdb()


@router.get("/test-email")
async def test_email():
    """Temporary endpoint to test email sending on Render."""
    from ..tasks import _send_email
    sender = os.getenv("EMAIL_SENDER", "NOT SET")
    password = os.getenv("EMAIL_PASSWORD", "NOT SET")
    smtp = os.getenv("SMTP_SERVER", "smtp.gmail.com (default)")
    
    result = _send_email(
        sender,
        "NovaDesk Test Email",
        "<h2>Email is working!</h2><p>Your NovaDesk email system is configured correctly.</p>",
        "Email is working! Your NovaDesk email system is configured correctly."
    )
    return {
        "email_sent": result,
        "smtp_server": smtp,
        "sender": sender,
        "password_configured": password != "NOT SET" and len(password) > 0,
    }



async def invalidate_single_ticket_cache(ticket_id: str, redis_client_instance: Optional[redis.Redis]):
    if redis_client_instance:
        await redis_client_instance.delete(f"ticket:{ticket_id}")


def _build_activity(action: str, user: UserInDB, field: str = None, old_value=None, new_value=None) -> dict:
    return ActivityLogSchema(
        action=action,
        field=field,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        performed_by=user.username,
        performed_by_role=user.role,
        timestamp=datetime.utcnow(),
    ).model_dump()


async def _log_field_changes(ticket_id: str, existing: dict, updates: dict, user: UserInDB):
    tracked_fields = {
        "status": "status_changed",
        "priority": "priority_changed",
        "assigned_to": "assigned",
        "title": "updated",
        "description": "updated",
        "category": "updated",
        "sla_deadline": "updated",
    }
    changes = []
    for field, action in tracked_fields.items():
        if field in updates and str(existing.get(field) or "") != str(updates[field] or ""):
            entry = _build_activity(action, user, field, existing.get(field), updates[field])
            await crud.append_activity_log(ticket_id, entry)
            changes.append(f"{field}: {existing.get(field) or 'none'} → {updates[field] or 'none'}")
    return changes



@router.get("/agents", response_model=list[AgentOut])
async def get_agents(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Not authorized to view agents")
    agents = await crud.retrieve_agents()
    return [AgentOut(**a) for a in agents]

@router.get("/{id}/eligible-assignees", response_model=list[AgentOut])
async def get_eligible_assignees(id: str, current_user: UserInDB = Depends(get_current_user)):
    if current_user.role not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Not authorized to view assignees")
    
    ticket = await crud.retrieve_ticket(id)
    if not ticket or not ticket.get("project_id"):
        all_agents = await crud.retrieve_agents()
        return [AgentOut(**a) for a in all_agents]
        
    project_members = await crud.get_project_members(ticket["project_id"])
    eligible = []
    async for u in crud.user_collection.find({"username": {"$in": project_members}}):
        eligible.append({"username": u["username"], "role": u.get("role", "user")})
    return [AgentOut(**e) for e in eligible]



@router.post("/", response_model=TicketInDB, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    priority: str = Form(default="Medium"),
    project_id: str = Form(...),
    custom_sla_hours: Optional[int] = Form(None),
    custom_fields_data: Optional[str] = Form(None),
    attachments: Optional[list[UploadFile]] = File(None),
):
    if category == "Auto-Detect (AI)":
        ai_classification = classify_ticket(title, description)
        category = ai_classification["category"]
        priority = ai_classification["priority"]
        
    if priority not in PRIORITY_LEVELS:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {', '.join(PRIORITY_LEVELS)}")

    attachment_urls = []
    if attachments:
        for file in attachments:
            if file.filename:
                file_path = os.path.join(UPLOAD_DIR, file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                attachment_urls.append(f"/{UPLOAD_DIR}/{file.filename}")

    now = datetime.utcnow()
    if custom_sla_hours is not None and custom_sla_hours > 0:
        sla_hours = custom_sla_hours
    else:
        sla_hours = {"Critical": 1, "High": 4, "Medium": 24, "Low": 72}.get(priority, 24)
    sla_deadline = now + timedelta(hours=sla_hours)

    least_busy_agent = await crud.get_least_busy_agent()
    
    activity_log = [
        ActivityLogSchema(
            action="created",
            performed_by=current_user.username,
            performed_by_role=current_user.role,
        )
    ]
    
    if least_busy_agent:
        activity_log.append(
            ActivityLogSchema(
                action="assigned",
                field="assigned_to",
                old_value="none",
                new_value=least_busy_agent,
                performed_by="System",
                performed_by_role="system",
            )
        )

    ticket_data = TicketSchema(
        title=title,
        description=description,
        category=category,
        priority=priority,
        attachments=attachment_urls,
        project_id=project_id,
        sla_deadline=sla_deadline,
        is_sla_breached=False,
        owner_username=current_user.username,
        assigned_to=least_busy_agent,
        activity_log=activity_log,
        custom_fields_data=json.loads(custom_fields_data) if custom_fields_data else {},
    )
    new_ticket_db_dict = await crud.add_ticket(ticket_data.model_dump())

    await invalidate_all_tickets_cache(redis_instance)
    await invalidate_single_ticket_cache(new_ticket_db_dict["id"], redis_instance)

    new_ticket_response = TicketInDB.model_validate(new_ticket_db_dict)

    await manager.broadcast({
        "event": "ticket_created",
        "ticket": new_ticket_response.model_dump(mode="json"),
    })

    if least_busy_agent:
        notif = NotificationSchema(
            username=least_busy_agent,
            message=f"You have been auto-assigned a new ticket: {new_ticket_response.title}",
            ticket_id=new_ticket_db_dict["id"]
        )
        notif_db = await crud.create_notification(notif.model_dump())
        notif_out = NotificationInDB.model_validate(notif_db)
        await manager.broadcast({"event": "new_notification", "notification": notif_out.model_dump(mode="json")})

    await _dispatch_creation_email(new_ticket_db_dict, current_user.username)

    return new_ticket_response


@router.get("/", response_model=list[TicketInDB])
async def get_all_tickets(
    current_user: UserInDB = Depends(get_current_user),
    search: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    my_assigned: Optional[bool] = None,
    project_id: Optional[str] = None,
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
):
    owner_filter = current_user.username if current_user.role == "user" else None
    cache_key = f"all_tickets_s:{search or 'none'}_c:{category or 'none'}_o:{owner_filter or 'all'}_a:{assigned_to or 'none'}_m:{my_assigned or 'none'}_p:{project_id or 'none'}_u:{current_user.username}"

    if redis_instance:
        cached = await redis_instance.get(cache_key)
        if cached:
            try:
                return [TicketInDB.model_validate(d) for d in json.loads(cached)]
            except Exception:
                pass

    tickets_from_db = await crud.retrieve_tickets(
        search=search,
        category=category,
        owner_username=owner_filter,
        assigned_to=assigned_to,
        my_assigned=my_assigned,
        current_username=current_user.username,
        project_id=project_id,
        allowed_projects=current_user.projects if current_user.role != 'admin' else None,
    )

    if redis_instance:
        await redis_instance.set(cache_key, json.dumps(tickets_from_db), ex=60)

    return [TicketInDB.model_validate(t) for t in tickets_from_db]


@router.get("/export/csv")
async def export_tickets_csv(
    current_user: UserInDB = Depends(get_current_user)
):
    if current_user.role not in ("admin", "agent"):
        raise HTTPException(status_code=403, detail="Not authorized to export tickets")

    tickets = await crud.retrieve_tickets()
    
    import io
    import csv
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Category", "Priority", "Status", "Created At", "Owner", "Assigned To", "SLA Breached", "CSAT Rating"])
    
    for t in tickets:
        writer.writerow([
            t["id"],
            t.get("title", ""),
            t.get("category", ""),
            t.get("priority", ""),
            t.get("status", ""),
            t.get("created", ""),
            t.get("owner_username", ""),
            t.get("assigned_to", ""),
            t.get("is_sla_breached", False),
            t.get("csat_rating", "")
        ])
    
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=tickets_export.csv"})

@router.get("/{id}", response_model=TicketInDB)
async def get_ticket_by_id(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
):
    cache_key = f"ticket:{id}"
    if redis_instance:
        cached = await redis_instance.get(cache_key)
        if cached:
            try:
                ticket_data = json.loads(cached)
                if current_user.role == "user":
                    if ticket_data.get("owner_username") != current_user.username:
                        raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
                    filtered_comments = [c for c in ticket_data.get("comments", []) if not c.get("is_private")]
                    ticket_data["comments"] = filtered_comments
                return TicketInDB.model_validate(ticket_data)
            except HTTPException:
                raise
            except Exception:
                pass

    ticket_dict = await crud.retrieve_ticket(id)
    if not ticket_dict:
        raise HTTPException(status_code=404, detail=f"Ticket with ID {id} not found")

    if current_user.role == "user":
        if ticket_dict.get("owner_username") != current_user.username:
            raise HTTPException(status_code=403, detail="Not authorized to view this ticket")
        filtered_comments = [c for c in ticket_dict.get("comments", []) if not c.get("is_private")]
        ticket_dict["comments"] = filtered_comments

    if redis_instance:
        await redis_instance.set(cache_key, json.dumps(ticket_dict), ex=30)

    return ticket_dict


@router.put("/{id}", response_model=TicketInDB)
async def update_ticket_data(
    id: str,
    request: Request,
    req: UpdateTicketSchema = Body(...),
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
):
    existing_ticket = await crud.retrieve_ticket(id)
    if not existing_ticket:
        raise HTTPException(status_code=404, detail=f"Ticket with ID {id} not found")

    if current_user.role == "user" and existing_ticket.get("owner_username") != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized to edit this ticket")

    req_dict = req.model_dump(exclude_unset=True)
    if not req_dict:
        raise HTTPException(status_code=400, detail="Request body cannot be empty")
        
    if "sla_deadline" in req_dict:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Only admins can modify the SLA deadline")
        if req_dict["sla_deadline"].replace(tzinfo=None) > datetime.utcnow():
            req_dict["is_sla_breached"] = False

    if req.status and req.status != existing_ticket.get("status"):
        if current_user.role == "user":
            raise HTTPException(status_code=403, detail="Users cannot change ticket status")

    if req.priority and req.priority not in PRIORITY_LEVELS:
        raise HTTPException(status_code=400, detail=f"Priority must be one of: {', '.join(PRIORITY_LEVELS)}")

    if req.assigned_to is not None and req.assigned_to != "":
        if current_user.role not in ("admin", "agent"):
            raise HTTPException(status_code=403, detail="Only admins or agents can assign tickets")
        if not await crud.user_exists(req.assigned_to):
            raise HTTPException(status_code=400, detail=f"User '{req.assigned_to}' not found")

    if "assigned_to" in req_dict and req_dict["assigned_to"] == "":
        req_dict["assigned_to"] = None

    if req.assigned_to and req.assigned_to != existing_ticket.get("assigned_to"):
        notif = NotificationSchema(
            username=req.assigned_to,
            message=f"You have been assigned to ticket: {existing_ticket['title']}",
            ticket_id=id
        )
        notif_db = await crud.create_notification(notif.model_dump())
        notif_out = NotificationInDB.model_validate(notif_db)
        await manager.broadcast({"event": "new_notification", "notification": notif_out.model_dump(mode="json")})

    changes = await _log_field_changes(id, existing_ticket, req_dict, current_user)

    updated = await crud.update_ticket(id, req_dict)
    if not updated and not changes:
        # If no changes were applied, just return the existing ticket instead of raising 404
        return existing_ticket

    await invalidate_all_tickets_cache(redis_instance)
    await invalidate_single_ticket_cache(id, redis_instance)

    updated_ticket_dict = await crud.retrieve_ticket(id)
    if updated_ticket_dict:
        if redis_instance:
            await redis_instance.set(f"ticket:{id}", json.dumps(updated_ticket_dict), ex=30)

        validated = TicketInDB.model_validate(updated_ticket_dict)
        await manager.broadcast({
            "event": "ticket_updated",
            "ticket": validated.model_dump(mode="json"),
        })

        if changes:
            summary = "; ".join(changes)
            await _dispatch_update_email(updated_ticket_dict, summary, current_user.username)

        return updated_ticket_dict

    raise HTTPException(status_code=404, detail=f"Ticket with ID {id} not found")


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket_by_id(
    id: str,
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can delete tickets")

    deleted = await crud.delete_ticket(id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Ticket with ID {id} not found")

    await invalidate_all_tickets_cache(redis_instance)
    await invalidate_single_ticket_cache(id, redis_instance)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{id}/comments", response_model=TicketInDB)
async def add_comment(
    id: str,
    text: str = Form(...),
    is_private: bool = Form(False),
    attachments: Optional[list[UploadFile]] = File(None),
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client),
):
    existing_ticket = await crud.retrieve_ticket(id)
    if not existing_ticket:
        raise HTTPException(status_code=404, detail=f"Ticket with ID {id} not found")

    if current_user.role == "user" and existing_ticket.get("owner_username") != current_user.username:
        raise HTTPException(status_code=403, detail="Not authorized to comment on this ticket")

    attachment_urls = []
    if attachments:
        for file in attachments:
            if file.filename:
                file_path = os.path.join(UPLOAD_DIR, file.filename)
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                attachment_urls.append(f"/{UPLOAD_DIR}/{file.filename}")

    comment = CommentSchema(
        text=text,
        author_username=current_user.username,
        author_role=current_user.role,
        attachments=attachment_urls,
        is_private=is_private,
    )

    updated = await crud.add_comment_to_ticket(id, comment.model_dump())
    if updated:
        activity = _build_activity("comment_added", current_user, "comment", None, "Private note" if is_private else text[:50])
        await crud.append_activity_log(id, activity)

        # Notify
        if current_user.username != existing_ticket.get("owner_username") and not is_private:
            notif = NotificationSchema(
                username=existing_ticket["owner_username"],
                message=f"New comment on your ticket: {existing_ticket['title']}",
                ticket_id=id
            )
            notif_db = await crud.create_notification(notif.model_dump())
            notif_out = NotificationInDB.model_validate(notif_db)
            await manager.broadcast({"event": "new_notification", "notification": notif_out.model_dump(mode="json")})
        elif current_user.username == existing_ticket.get("owner_username") and existing_ticket.get("assigned_to"):
            notif = NotificationSchema(
                username=existing_ticket["assigned_to"],
                message=f"New comment from user on ticket: {existing_ticket['title']}",
                ticket_id=id
            )
            notif_db = await crud.create_notification(notif.model_dump())
            notif_out = NotificationInDB.model_validate(notif_db)
            await manager.broadcast({"event": "new_notification", "notification": notif_out.model_dump(mode="json")})

        await invalidate_all_tickets_cache(redis_instance)
        await invalidate_single_ticket_cache(id, redis_instance)

        updated_ticket_dict = await crud.retrieve_ticket(id)
        if updated_ticket_dict:
            if redis_instance:
                await redis_instance.set(f"ticket:{id}", json.dumps(updated_ticket_dict), ex=30)

            validated = TicketInDB.model_validate(updated_ticket_dict)
            await manager.broadcast({
                "event": "ticket_updated",
                "ticket": validated.model_dump(mode="json"),
            })

            await _dispatch_update_email(updated_ticket_dict, f"New comment by {current_user.username}", current_user.username)
            return updated_ticket_dict

    raise HTTPException(status_code=500, detail="Failed to add comment")

@router.get("/{id}/similar", response_model=list[TicketInDB])
async def get_similar_tickets(
    id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    ticket = await crud.retrieve_ticket(id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    similar_tickets = await crud.find_similar_tickets(id, ticket["title"])
    return [TicketInDB.model_validate(t) for t in similar_tickets]

@router.get("/{id}/ai-reply")
async def generate_ai_reply(
    id: str,
    current_user: UserInDB = Depends(get_current_user)
):
    # AI reply is available to all authenticated users
        
    ticket = await crud.retrieve_ticket(id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    context = {
        "title": ticket.get("title"),
        "description": ticket.get("description"),
        "category": ticket.get("category"),
    }
    
    public_comments = [
        {"author": c["author_username"], "content": c["text"]}
        for c in ticket.get("comments", [])
        if not c.get("is_private")
    ]
    
    draft = generate_suggested_reply(context, public_comments)
    return {"reply": draft}

@router.post("/{id}/csat")
async def submit_csat(
    id: str,
    csat_data: CSATSubmitSchema,
    current_user: UserInDB = Depends(get_current_user),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client)
):
    existing_ticket = await crud.retrieve_ticket(id)
    if not existing_ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if current_user.username != existing_ticket.get("owner_username"):
        raise HTTPException(status_code=403, detail="Only the ticket owner can submit a CSAT rating")
        
    if existing_ticket.get("status") not in ("Closed", "Resolved"):
        raise HTTPException(status_code=400, detail="Ticket must be closed or resolved to submit a rating")
        
    update_data = {
        "csat_rating": csat_data.csat_rating,
        "csat_feedback": csat_data.csat_feedback
    }
    updated = await crud.update_ticket(id, update_data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to save CSAT rating")
        
    activity = _build_activity("csat_submitted", current_user, "csat_rating", None, csat_data.csat_rating)
    await crud.append_activity_log(id, activity)
    
    await invalidate_all_tickets_cache(redis_instance)
    await invalidate_single_ticket_cache(id, redis_instance)
    
    updated_ticket = await crud.retrieve_ticket(id)
    validated = TicketInDB.model_validate(updated_ticket)
    await manager.broadcast({
        "event": "ticket_updated",
        "ticket": validated.model_dump(mode="json"),
    })
    
    return {"message": "CSAT rating submitted successfully"}
