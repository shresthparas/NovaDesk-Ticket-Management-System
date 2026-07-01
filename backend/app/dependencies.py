
# backend/app/dependencies.py

import motor.motor_asyncio #async MongoDB driver
from bson.objectid import ObjectId
import os 
import redis.asyncio as redis 
from typing import Optional 


from passlib.context import CryptContext 
from jose import JWTError, jwt 
from fastapi.security import OAuth2PasswordBearer  #extract jwt token from request
from fastapi import HTTPException, status, Depends 
from datetime import datetime, timedelta 


MONGO_DETAILS = os.getenv("MONGO_DETAILS", "mongodb://mongodb:27017") 

client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_DETAILS)
database = client.tickets

ticket_collection = database.get_collection("tickets_collection")
user_collection = database.get_collection("users_collection") 
notification_collection = database.get_collection("notifications_collection")
project_collection = database.get_collection("projects_collection")



REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379") 
global_redis_client_instance = None # Will hold the connected Redis client


def project_helper(project) -> dict:
    return {
        "id": str(project["_id"]),
        "project_id": project["project_id"],
        "name": project["name"],
        "members": project.get("members", []),
        "description": project.get("description", "")
    }

#Transforms a MongoDB document into a dict
def ticket_helper(ticket) -> dict:
    return {
        "id": str(ticket["_id"]),
        "title": ticket["title"],
        "description": ticket["description"],
        "category": ticket["category"],
        "status": ticket["status"],
        "priority": ticket.get("priority", "Medium"),
        "created": ticket["created"],
        "attachments": ticket.get("attachments", []),
        "project_id": ticket.get("project_id"),
        "sla_deadline": ticket.get("sla_deadline"),
        "is_sla_breached": ticket.get("is_sla_breached", False),
        "owner_username": ticket.get("owner_username"),
        "assigned_to": ticket.get("assigned_to"),
        "comments": ticket.get("comments", []),
        "activity_log": ticket.get("activity_log", []),
        "custom_fields_data": ticket.get("custom_fields_data", {}),
        "csat_rating": ticket.get("csat_rating"),
        "csat_feedback": ticket.get("csat_feedback"),
    }




pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


SECRET_KEY = os.getenv("SECRET_KEY", "your-super-long-and-random-secret-key-that-you-must-change-in-production") 
ALGORITHM = "HS256" 
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login") 


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire}) 
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}, 
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        return payload
    except JWTError: 
        raise credentials_exception



async def connect_redis():
    """Initializes the global Redis client connection."""
    global global_redis_client_instance
    try:
        # Create a Redis client instance from the URL
        global_redis_client_instance = redis.Redis(
            host=os.getenv("REDIS_HOST", "redis"), 
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_responses=True 
        )
        await global_redis_client_instance.ping() 
        print("Connected to Redis!")
    except Exception as e:
        print(f"Could not connect to Redis: {e}")
        global_redis_client_instance = None 

async def disconnect_redis():
    """Closes the global Redis client connection."""
    global global_redis_client_instance
    if global_redis_client_instance:
        await global_redis_client_instance.close() 
        print("Disconnected from Redis!")
    global_redis_client_instance = None 

async def get_redis_client() -> Optional[redis.Redis]: 
    """Provides a Redis client instance to FastAPI route handlers."""
    if not global_redis_client_instance:
        print("Warning: Redis client not available via dependency (connection failed at startup).")
        yield None 
    else:
        yield global_redis_client_instance


#  Dependency for Current user 
async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Dependency that authenticates the user by validating the JWT token
    and retrieving their details from the user collection.
    """
    
    from .models import UserInDB 

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_payload = await decode_access_token(token)
    if token_payload is None: 
        raise credentials_exception

    username = token_payload.get("sub") 
    if username is None:
        raise credentials_exception

   
    user_in_db_doc = await user_collection.find_one({"username": username})
    if user_in_db_doc is None:
        user_in_db_doc = await user_collection.find_one({"email": username})

    if user_in_db_doc is None: 
        raise credentials_exception

    
    try:
        user_model = UserInDB.model_validate(user_in_db_doc) 
    except Exception as e:
        print(f"Error validating user from DB against UserInDB schema: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing user data from database"
        )
        
    return user_model