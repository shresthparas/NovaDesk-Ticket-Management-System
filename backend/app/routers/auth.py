from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
import os
import pika
import json
import secrets
import redis.asyncio as redis

from ..dependencies import (
    user_collection, get_password_hash, verify_password, 
    create_access_token, get_current_user, get_redis_client
)
from ..models import UserRegister, StaffRegister, UserOut, UserInDB, UpdateProfileSchema

router = APIRouter(prefix="/api", tags=["Auth"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserRegister):
    existing_user_by_username = await user_collection.find_one({"username": user_data.username})
    if existing_user_by_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    
    existing_user_by_email = await user_collection.find_one({"email": user_data.email})
    if existing_user_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    
    username_lower = user_data.username.lower()
    if username_lower == "admin":
        role = "admin"
    elif username_lower == "agent":
        role = "agent"
    else:
        role = "user"
    
    user_in_db = UserInDB(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=role
    )
    
    new_user = await user_collection.insert_one(user_in_db.model_dump(by_alias=True, exclude_unset=True)) 
    
    created_user_doc = await user_collection.find_one({"_id": new_user.inserted_id})
    return UserOut.model_validate(created_user_doc) 


@router.post("/register/staff", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_staff(user_data: StaffRegister):
    if user_data.staff_code != "NOVA2026":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid staff access code")

    existing_user_by_username = await user_collection.find_one({"username": user_data.username})
    if existing_user_by_username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    
    existing_user_by_email = await user_collection.find_one({"email": user_data.email})
    if existing_user_by_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    
    user_in_db = UserInDB(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        role=user_data.role
    )
    
    new_user = await user_collection.insert_one(user_in_db.model_dump(by_alias=True, exclude_unset=True)) 
    
    created_user_doc = await user_collection.find_one({"_id": new_user.inserted_id})
    return UserOut.model_validate(created_user_doc)

@router.post("/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user_from_db_doc = await user_collection.find_one({
        "$or": [{"username": form_data.username}, {"email": form_data.username}]
    })

    if not user_from_db_doc or not verify_password(form_data.password, user_from_db_doc["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"}, 
        )
    
    access_token = create_access_token(data={"sub": user_from_db_doc["username"]})
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users")
async def get_all_users(current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    users = []
    async for user in user_collection.find({}, {"hashed_password": 0}):
        user["_id"] = str(user["_id"])
        users.append(user)
    return users

@router.get("/users/me", response_model=UserOut)
async def get_users_me(current_user: UserInDB = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    body: dict = Body(...),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client)
):
    email = body.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required")

    user = await user_collection.find_one({"email": email})
    if not user:
        return {"message": "If an account with this email exists, a password reset link has been sent."}

    reset_token = secrets.token_urlsafe(32)
    
    if redis_instance:
        await redis_instance.set(f"reset:{reset_token}", user["email"], ex=900)
    else:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Password reset service is temporarily unavailable.")

    try:
        from ..tasks import send_password_reset_email
        send_password_reset_email.delay(user["email"], reset_token)
    except Exception as e:
        print(f"Could not dispatch password reset email task: {e}")
        try:
            rabbitmq_url = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")
            connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
            channel = connection.channel()
            channel.queue_declare(queue='password_reset_queue', durable=True)
            message = json.dumps({"email": user["email"], "token": reset_token})
            channel.basic_publish(
                exchange='',
                routing_key='password_reset_queue',
                body=message,
                properties=pika.BasicProperties(delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE))
            connection.close()
        except Exception as rabbit_err:
            print(f"Could not publish message to RabbitMQ: {rabbit_err}")
        
    return {"message": "If an account with this email exists, a password reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    body: dict = Body(...),
    redis_instance: Optional[redis.Redis] = Depends(get_redis_client)
):
    token = body.get("token")
    new_password = body.get("new_password")

    if not token or not new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token and new password are required")

    if not redis_instance:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service is temporarily unavailable.")
        
    email = await redis_instance.get(f"reset:{token}")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    hashed_password = get_password_hash(new_password)
    result = await user_collection.update_one(
        {"email": email},
        {"$set": {"hashed_password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await redis_instance.delete(f"reset:{token}")

    return {"message": "Your password has been reset successfully."}


@router.put("/users/profile", response_model=UserOut)
async def update_user_profile(
    body: UpdateProfileSchema,
    current_user: UserInDB = Depends(get_current_user)
):
    update_data = {}
    
    if body.email and body.email != current_user.email:
        existing_email = await user_collection.find_one({"email": body.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_data["email"] = body.email

    if body.new_password:
        if not body.old_password:
            raise HTTPException(status_code=400, detail="Old password is required to set a new password")
        if not verify_password(body.old_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect old password")
        update_data["hashed_password"] = get_password_hash(body.new_password)

    if not update_data:
        raise HTTPException(status_code=400, detail="No updates provided")

    await user_collection.update_one(
        {"username": current_user.username},
        {"$set": update_data}
    )

    updated_user = await user_collection.find_one({"username": current_user.username})
    return updated_user

@router.put("/users/{username}/role")
async def update_user_role(username: str, body: dict = Body(...), current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_role = body.get("role")
    if new_role not in ["user", "agent", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'user', 'agent', or 'admin'")
    
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    
    result = await user_collection.update_one(
        {"username": username},
        {"$set": {"role": new_role}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"Role updated to '{new_role}' for user '{username}'"}


@router.delete("/users/{username}")
async def delete_user(username: str, current_user: UserInDB = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    
    result = await user_collection.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User '{username}' has been deleted"}
