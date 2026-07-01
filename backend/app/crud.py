from bson.objectid import ObjectId
from .dependencies import ticket_collection, ticket_helper, user_collection, notification_collection, project_collection, project_helper
from fastapi.encoders import jsonable_encoder
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


async def retrieve_tickets(
    search: Optional[str] = None,
    category: Optional[str] = None,
    owner_username: Optional[str] = None,
    assigned_to: Optional[str] = None,
    my_assigned: Optional[bool] = None,
    current_username: Optional[str] = None,
    project_id: Optional[str] = None,
    allowed_projects: Optional[List[str]] = None,
) -> List[Dict]:
    """Retrieves tickets with optional filtering."""
    query = {}
    extra_conditions = []

    if search:
        search_criteria = []
        if ObjectId.is_valid(search):
            search_criteria.append({"_id": ObjectId(search)})
        search_criteria.append({"title": {"$regex": search, "$options": "i"}})
        search_criteria.append({"description": {"$regex": search, "$options": "i"}})
        extra_conditions.append({"$or": search_criteria})

    if category and category != "All Categories":
        query["category"] = category

    if owner_username:
        query["owner_username"] = owner_username

    if my_assigned and current_username:
        query["assigned_to"] = current_username
    elif assigned_to:
        if assigned_to == "unassigned":
            extra_conditions.append({
                "$or": [
                    {"assigned_to": None},
                    {"assigned_to": ""},
                    {"assigned_to": {"$exists": False}},
                ]
            })
        else:
            query["assigned_to"] = assigned_to

    if project_id:
        query["project_id"] = project_id
    elif allowed_projects is not None:
        query["$or"] = [
            {"project_id": {"$in": allowed_projects}},
            {"project_id": {"$exists": False}},
            {"project_id": None},
            {"project_id": ""}
        ]

    if extra_conditions:
        if len(extra_conditions) == 1:
            query.update(extra_conditions[0])
        else:
            query["$and"] = extra_conditions

    tickets = []
    async for ticket in ticket_collection.find(query):
        tickets.append(ticket_helper(ticket))
    return tickets


async def add_ticket(ticket_data: dict) -> dict:
    logger.info(f"Adding ticket: {ticket_data}")
    result = await ticket_collection.insert_one(jsonable_encoder(ticket_data))
    new_ticket = await ticket_collection.find_one({"_id": result.inserted_id})
    return ticket_helper(new_ticket)


async def retrieve_ticket(id: str) -> Optional[Dict]:
    if not ObjectId.is_valid(id):
        return None
    ticket = await ticket_collection.find_one({"_id": ObjectId(id)})
    if ticket:
        return ticket_helper(ticket)
    return None

import re
async def find_similar_tickets(ticket_id: str, title: str, limit: int = 5) -> List[Dict]:
    words = [w for w in re.split(r'\W+', title.lower()) if len(w) > 3]
    if not words:
        return []
    regex_pattern = "|".join(words)
    query = {
        "_id": {"$ne": ObjectId(ticket_id) if ObjectId.is_valid(ticket_id) else None},
        "title": {"$regex": regex_pattern, "$options": "i"}
    }
    
    similar = []
    async for ticket in ticket_collection.find(query).limit(limit):
        similar.append(ticket_helper(ticket))
    return similar


async def update_ticket(id: str, data: dict) -> bool:
    if len(data) < 1:
        return False
    if not ObjectId.is_valid(id):
        return False
    existing_ticket = await ticket_collection.find_one({"_id": ObjectId(id)})
    if existing_ticket:
        updated_result = await ticket_collection.update_one(
            {"_id": ObjectId(id)}, {"$set": jsonable_encoder(data)}
        )
        return updated_result.modified_count > 0
    return False


async def append_activity_log(id: str, activity_entry: dict) -> bool:
    if not ObjectId.is_valid(id):
        return False
    updated_result = await ticket_collection.update_one(
        {"_id": ObjectId(id)},
        {"$push": {"activity_log": jsonable_encoder(activity_entry)}},
    )
    return updated_result.modified_count > 0


async def delete_ticket(id: str) -> bool:
    if not ObjectId.is_valid(id):
        return False
    ticket = await ticket_collection.find_one({"_id": ObjectId(id)})
    if ticket:
        deleted_result = await ticket_collection.delete_one({"_id": ObjectId(id)})
        return deleted_result.deleted_count > 0
    return False


async def add_comment_to_ticket(id: str, comment_data: dict) -> bool:
    if not ObjectId.is_valid(id):
        return False
    updated_result = await ticket_collection.update_one(
        {"_id": ObjectId(id)}, {"$push": {"comments": jsonable_encoder(comment_data)}}
    )
    return updated_result.modified_count > 0


async def retrieve_agents() -> List[Dict]:
    agents = []
    async for user in user_collection.find({"role": {"$in": ["agent", "admin"]}}):
        agents.append({"username": user["username"], "role": user.get("role", "agent")})
    return agents

async def get_least_busy_agent() -> Optional[str]:
    agents = await retrieve_agents()
    if not agents:
        return None
        
    agent_usernames = [a["username"] for a in agents]
    counts = {username: 0 for username in agent_usernames}
    
    async for ticket in ticket_collection.find({"status": {"$in": ["Open", "In Progress"]}}):
        assigned = ticket.get("assigned_to")
        if assigned in counts:
            counts[assigned] += 1
            
    if not counts:
        return agent_usernames[0] if agent_usernames else None
        
    return min(counts, key=counts.get)


async def user_exists(username: str) -> bool:
    user = await user_collection.find_one({"username": username})
    return user is not None

async def create_notification(notification_data: dict) -> dict:
    result = await notification_collection.insert_one(jsonable_encoder(notification_data))
    new_notif = await notification_collection.find_one({"_id": result.inserted_id})
    return new_notif

async def get_notifications(username: str) -> list[dict]:
    notifications = []
    async for notif in notification_collection.find({"username": username}).sort("created_at", -1).limit(50):
        notif["id"] = str(notif["_id"])
        notifications.append(notif)
    return notifications

async def mark_notification_read(id: str) -> bool:
    if not ObjectId.is_valid(id):
        return False
    updated = await notification_collection.update_one({"_id": ObjectId(id)}, {"$set": {"is_read": True}})
    return updated.matched_count > 0

async def delete_notification(id: str) -> bool:
    if not ObjectId.is_valid(id):
        return False
    result = await notification_collection.delete_one({"_id": ObjectId(id)})
    return result.deleted_count > 0

async def clear_notifications(username: str) -> bool:
    result = await notification_collection.delete_many({"username": username})
    return result.acknowledged

# --- Project CRUD ---

async def create_project(project_data: dict) -> dict:
    result = await project_collection.insert_one(project_data)
    new_project = await project_collection.find_one({"_id": result.inserted_id})
    return project_helper(new_project)

async def retrieve_project(project_id: str) -> Optional[dict]:
    project = await project_collection.find_one({"project_id": project_id})
    if project:
        return project_helper(project)
    return None

async def get_user_projects(username: str) -> List[dict]:
    projects = []
    cursor = project_collection.find({"members": username})
    async for doc in cursor:
        projects.append(project_helper(doc))
    return projects

async def add_member_to_project(project_id: str, username: str) -> bool:
    result = await project_collection.update_one(
        {"project_id": project_id},
        {"$addToSet": {"members": username}}
    )
    if result.modified_count > 0:
        await user_collection.update_one(
            {"username": username},
            {"$addToSet": {"projects": project_id}}
        )
        return True
    return False

async def get_project_members(project_id: str) -> List[str]:
    project = await project_collection.find_one({"project_id": project_id})
    if project:
        return project.get("members", [])
    return []
