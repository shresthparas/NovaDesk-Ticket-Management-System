# backend/app/main.py

from contextlib import asynccontextmanager 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from .dependencies import connect_redis, disconnect_redis
from .routers import auth, tickets, websockets, notifications, projects

#async context manager for lifespan events(startup/shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_redis() 
    yield # The application runs during this context
    await disconnect_redis() 

# Initialize FastAPI application
app = FastAPI(title="Support Ticket API", lifespan=lifespan) 

# CORS Configuration 
origins = [
    "*", 
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# File Upload Configuration
UPLOAD_DIR = "uploads" 
os.makedirs(UPLOAD_DIR, exist_ok=True) 

# Mount this directory to serve files 
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(tickets.router)
app.include_router(notifications.router)
app.include_router(projects.router)
app.include_router(websockets.router, prefix="/api")