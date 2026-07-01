

from .celery_app import celery_app
from .dependencies import ticket_collection, user_collection, ticket_helper
from bson import ObjectId
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio


def _send_email(to_email: str, subject: str, html_content: str, text_content: str):
    smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    sender_email = os.getenv("EMAIL_SENDER")
    sender_password = os.getenv("EMAIL_PASSWORD", "").replace(" ", "")

    if not sender_email or not sender_password:
        print(f" [EMAIL] SMTP settings missing — EMAIL_SENDER={sender_email}, PASSWORD={'set' if sender_password else 'MISSING'}")
        return False

    print(f" [EMAIL] Attempting to send to {to_email} via {smtp_server}:{smtp_port} from {sender_email}")

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"NovaDesk Support <{sender_email}>"
    message["To"] = to_email
    message.attach(MIMEText(text_content, "plain"))
    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message.as_string())
        print(f" [EMAIL] Successfully sent to {to_email}")
        return True
    except Exception as e:
        print(f" [EMAIL] Failed to send to {to_email}: {type(e).__name__}: {e}")
        return False


def _run_async(coro):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.run_coroutine_threadsafe(coro, loop)
            return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)


async def _get_ticket_and_owner_email(ticket_id: str):
    ticket = await ticket_collection.find_one({"_id": ObjectId(ticket_id)})
    if not ticket:
        return None, None
    formatted = ticket_helper(ticket)
    owner = await user_collection.find_one({"username": ticket.get("owner_username")})
    owner_email = owner["email"] if owner else None
    return formatted, owner_email


async def _get_user_email(username: str):
    user = await user_collection.find_one({"username": username})
    return user["email"] if user else None


@celery_app.task(name="send_ticket_creation_email")
def send_ticket_creation_email(ticket_id: str, owner_username: str):
    print(f" [CELERY WORKER] send_ticket_creation_email for ticket {ticket_id}")

    async def _send():
        formatted, owner_email = await _get_ticket_and_owner_email(ticket_id)
        if not formatted or not owner_email:
            return f"No ticket or owner email for {ticket_id}"
        subject = f"Ticket Created: #{formatted['id'][:8]} — {formatted['title']}"
        text = (
            f"Your ticket '{formatted['title']}' has been created.\n"
            f"Priority: {formatted.get('priority', 'Medium')}\n"
            f"Status: {formatted['status']}\n"
            f"Ticket ID: {formatted['id']}"
        )
        html = f"""
        <h2>Ticket Created</h2>
        <p>Your support ticket has been submitted successfully.</p>
        <ul>
          <li><strong>Title:</strong> {formatted['title']}</li>
          <li><strong>Priority:</strong> {formatted.get('priority', 'Medium')}</li>
          <li><strong>Status:</strong> {formatted['status']}</li>
          <li><strong>ID:</strong> {formatted['id']}</li>
        </ul>
        """
        _send_email(owner_email, subject, html, text)
        return f"Creation email sent to {owner_email}"

    return _run_async(_send())


@celery_app.task(name="send_ticket_update_email")
def send_ticket_update_email(ticket_id: str, change_summary: str, notify_username: str = None):
    print(f" [CELERY WORKER] send_ticket_update_email for ticket {ticket_id}")

    async def _send():
        formatted, owner_email = await _get_ticket_and_owner_email(ticket_id)
        if not formatted:
            return f"No ticket found for {ticket_id}"

        recipients = set()
        if owner_email:
            recipients.add(owner_email)
        if notify_username:
            agent_email = await _get_user_email(notify_username)
            if agent_email:
                recipients.add(agent_email)
        assigned = formatted.get("assigned_to")
        if assigned:
            assigned_email = await _get_user_email(assigned)
            if assigned_email:
                recipients.add(assigned_email)

        subject = f"Ticket Updated: #{formatted['id'][:8]} — {formatted['title']}"
        text = f"Ticket '{formatted['title']}' was updated.\n\nChanges:\n{change_summary}\n\nCurrent status: {formatted['status']}"
        html = f"""
        <h2>Ticket Updated</h2>
        <p><strong>{formatted['title']}</strong></p>
        <p>{change_summary}</p>
        <p>Current status: <strong>{formatted['status']}</strong></p>
        <p>Priority: <strong>{formatted.get('priority', 'Medium')}</strong></p>
        """

        for email in recipients:
            _send_email(email, subject, html, text)
        return f"Update emails sent to {len(recipients)} recipient(s)"

    return _run_async(_send())


@celery_app.task(name="send_password_reset_email")
def send_password_reset_email(email: str, token: str):
    print(f" [CELERY WORKER] send_password_reset_email for {email}")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    reset_link = f"{frontend_url}/reset-password?token={token}"
    subject = "Your Password Reset Link"
    text = f"Reset your password: {reset_link}"
    html = f'<h2>Password Reset</h2><p><a href="{reset_link}">Reset Password</a></p>'
    _send_email(email, subject, html, text)
    return f"Password reset email sent to {email}"

from datetime import datetime

@celery_app.task(name="check_sla_breaches")
def check_sla_breaches():
    print(" [CELERY WORKER] Checking for SLA breaches...")

    async def _check():
        now = datetime.utcnow()
        query = {
            "status": {"$nin": ["Closed", "Resolved"]},
            "is_sla_breached": {"$ne": True},
            "sla_deadline": {"$lt": now}
        }
        cursor = ticket_collection.find(query)
        breached_tickets = await cursor.to_list(length=100)
        
        for ticket in breached_tickets:
            ticket_id = str(ticket["_id"])
            current_priority = ticket.get("priority", "Medium")
            new_priority = "Critical"
            if current_priority == "Low": new_priority = "Medium"
            elif current_priority == "Medium": new_priority = "High"
            
            update_data = {
                "is_sla_breached": True,
                "priority": new_priority
            }
            
            await ticket_collection.update_one(
                {"_id": ticket["_id"]},
                {"$set": update_data}
            )
            
            activity = {
                "action": "priority_changed",
                "field": "priority",
                "old_value": current_priority,
                "new_value": new_priority,
                "performed_by": "System",
                "performed_by_role": "system",
                "timestamp": datetime.utcnow()
            }
            await ticket_collection.update_one(
                {"_id": ticket["_id"]},
                {"$push": {"activity_log": activity}}
            )
            
            print(f" [CELERY WORKER] Ticket {ticket_id} breached SLA and escalated to {new_priority}.")
            
            send_ticket_update_email.delay(
                ticket_id,
                f"SLA breached! Ticket priority automatically escalated from {current_priority} to {new_priority}."
            )
        
        return f"Checked SLA, {len(breached_tickets)} breached."

    return _run_async(_check())

from datetime import timedelta
@celery_app.task(name="check_sla_warnings")
def check_sla_warnings():
    print(" [CELERY WORKER] Checking for SLA warnings...")

    async def _check():
        now = datetime.utcnow()
        warning_time = now + timedelta(hours=1)
        
        query = {
            "status": {"$nin": ["Closed", "Resolved"]},
            "sla_warning_sent": {"$ne": True},
            "sla_deadline": {"$gt": now, "$lt": warning_time}
        }
        cursor = ticket_collection.find(query)
        warning_tickets = await cursor.to_list(length=100)
        
        for ticket in warning_tickets:
            ticket_id = str(ticket["_id"])
            
            await ticket_collection.update_one(
                {"_id": ticket["_id"]},
                {"$set": {"sla_warning_sent": True}}
            )
            
            print(f" [CELERY WORKER] Ticket {ticket_id} is close to SLA breach.")
            
            send_ticket_update_email.delay(
                ticket_id,
                f"SLA Warning: Ticket is due to breach SLA within 1 hour."
            )
            
            assigned_to = ticket.get("assigned_to")
            if assigned_to:
                from .dependencies import notification_collection
                notif = {
                    "username": assigned_to,
                    "message": f"SLA Warning: Ticket '{ticket.get('title')}' breaches SLA in < 1 hr",
                    "ticket_id": ticket_id,
                    "is_read": False,
                    "created_at": datetime.utcnow()
                }
                await notification_collection.insert_one(notif)
                
                # For real-time ws notification we'd broadcast but we are inside celery worker.
                # Just the DB insert is enough; it will show up next time they fetch or if we have Redis pubsub.
                
        return f"Checked SLA warnings, {len(warning_tickets)} warnings sent."

    return _run_async(_check())
