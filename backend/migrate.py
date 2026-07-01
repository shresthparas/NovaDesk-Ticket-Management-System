import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb://mongodb:27017")

async def migrate():
    print(f"Connecting to {MONGO_DETAILS}")
    client = AsyncIOMotorClient(MONGO_DETAILS)
    database = client.tickets
    
    user_collection = database.get_collection("users_collection")
    ticket_collection = database.get_collection("tickets_collection")
    
    # 1. Update users
    print("Updating users...")
    async for user in user_collection.find():
        if "role" not in user:
            role = "admin" if user.get("username", "").lower() == "admin" else "user"
            await user_collection.update_one({"_id": user["_id"]}, {"$set": {"role": role}})
            print(f"Updated user {user.get('username')} with role: {role}")

    # 2. Update tickets with new fields
    print("Updating tickets...")
    async for ticket in ticket_collection.find():
        updates = {}
        if "owner_username" not in ticket or not ticket["owner_username"]:
            updates["owner_username"] = "admin"
        if "priority" not in ticket:
            updates["priority"] = "Medium"
        if "assigned_to" not in ticket:
            updates["assigned_to"] = None
        if "activity_log" not in ticket:
            updates["activity_log"] = []
        if "comments" not in ticket:
            updates["comments"] = []
        if updates:
            await ticket_collection.update_one({"_id": ticket["_id"]}, {"$set": updates})
            print(f"Updated ticket {ticket.get('title', ticket['_id'])}")

    print("Migration complete!")
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
