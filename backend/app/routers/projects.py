from fastapi import APIRouter, Depends, HTTPException
from typing import List
from pydantic import BaseModel

from .. import crud
from ..models import UserInDB, ProjectSchema
from .auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Projects"])

class AddMemberRequest(BaseModel):
    username: str

import uuid

class ProjectCreateRequest(BaseModel):
    name: str
    description: str = ""
    members: List[str] = []

@router.post("", response_model=ProjectSchema)
async def create_project(
    project_data: ProjectCreateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create projects")
    
    # Generate unique 6-character code
    generated_id = "PRJ-" + uuid.uuid4().hex[:6].upper()
    
    # Automatically add the creator as a member if not already
    if current_user.username not in project_data.members:
        project_data.members.append(current_user.username)
        
    new_project = ProjectSchema(
        project_id=generated_id,
        name=project_data.name,
        description=project_data.description,
        members=project_data.members
    )
    
    created_project = await crud.create_project(new_project.model_dump())
    
    # Update all member users' project lists
    for member in new_project.members:
        await crud.add_member_to_project(created_project["project_id"], member)
        
    return created_project

class JoinProjectRequest(BaseModel):
    project_id: str

@router.post("/join")
async def join_project(
    req: JoinProjectRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    # Verify project exists
    existing = await crud.retrieve_project(req.project_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Project not found or invalid code")
        
    if current_user.username in existing.get("members", []):
        raise HTTPException(status_code=400, detail="You are already a member of this project")
        
    await crud.add_member_to_project(req.project_id, current_user.username)
    return {"message": "Successfully joined project!"}

@router.get("", response_model=List[ProjectSchema])
async def get_projects(current_user: UserInDB = Depends(get_current_user)):
    projects = await crud.get_user_projects(current_user.username)
    return projects

@router.post("/{project_id}/members")
async def add_project_member(
    project_id: str,
    req: AddMemberRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add members to projects")
    
    project = await crud.retrieve_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    success = await crud.add_member_to_project(project_id, req.username)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to add member")
    
    return {"status": "success", "message": f"Added {req.username} to {project_id}"}
