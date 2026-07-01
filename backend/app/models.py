import os

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from typing import Optional, Annotated, Literal
from datetime import datetime
from bson import ObjectId

PyObjectId = Annotated[str, BeforeValidator(str)]

PRIORITY_LEVELS = ("Low", "Medium", "High", "Critical")


class ProjectSchema(BaseModel):
    project_id: str = Field(..., description="Unique alphanumeric identifier (e.g. proj-alpha)")
    name: str = Field(..., description="Human-readable project name")
    members: list[str] = Field(default_factory=list, description="Usernames of members")
    description: Optional[str] = Field(default=None, description="Optional description of project")

class ProjectInDB(ProjectSchema):
    id: PyObjectId = Field(alias="_id", default_factory=ObjectId)



class ActivityLogSchema(BaseModel):
    action: str = Field(..., description="Action type: created, updated, assigned, status_changed, priority_changed, comment_added")
    field: Optional[str] = Field(default=None, description="Field that was changed")
    old_value: Optional[str] = Field(default=None)
    new_value: Optional[str] = Field(default=None)
    performed_by: str = Field(..., description="Username who performed the action")
    performed_by_role: str = Field(..., description="Role of the user")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class CommentSchema(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000, description="The comment text")
    author_username: str = Field(..., description="The username of the comment author")
    author_role: str = Field(..., description="The role of the comment author")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp of the comment")
    attachments: list[str] = Field(default_factory=list, description="List of attachment URLs")
    is_private: bool = Field(default=False, description="True if this is an internal note only visible to staff")


class TicketSchema(BaseModel):
    title: str = Field(..., min_length=3, max_length=100, description="The title of the ticket")
    description: str = Field(..., min_length=3, max_length=5000, description="The detailed description of the issue or feedback")
    category: str = Field(..., description="The category of the ticket, e.g., 'Bug', 'Feedback'")
    status: str = Field(default="Open", description="The current status of the ticket")
    priority: str = Field(default="Medium", description="Priority level: Low, Medium, High, Critical")
    created: datetime = Field(default_factory=datetime.utcnow, description="The UTC timestamp when the ticket was created")
    attachments: list[str] = Field(default_factory=list, description="List of attachment URLs")
    project_id: Optional[str] = Field(default=None, description="The project this ticket belongs to")
    sla_deadline: Optional[datetime] = Field(default=None, description="SLA deadline timestamp")
    is_sla_breached: bool = Field(default=False, description="Whether the SLA has been breached")
    owner_username: Optional[str] = Field(default=None, description="The username of the user who created this ticket")
    assigned_to: Optional[str] = Field(default=None, description="Username of the assigned agent")
    comments: list[CommentSchema] = Field(default_factory=list, description="List of comments on the ticket")
    activity_log: list[ActivityLogSchema] = Field(default_factory=list, description="Audit trail of ticket changes")
    custom_fields_data: dict = Field(default_factory=dict, description="Arbitrary category-specific custom fields")
    csat_rating: Optional[int] = Field(default=None, description="Customer Satisfaction Rating (1-5)")
    csat_feedback: Optional[str] = Field(default=None, description="Optional feedback text for the rating")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Login Button Not Working",
                "description": "Users are reporting that clicking the login button does nothing.",
                "category": "Bug",
                "priority": "High",
                "owner_username": "johndoe"
            }
        }
    )


class TicketInDB(TicketSchema):
    id: PyObjectId = Field(default_factory=ObjectId)
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class UpdateTicketSchema(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, min_length=3, max_length=500)
    category: Optional[str] = Field(None)
    status: Optional[str] = Field(None)
    priority: Optional[str] = Field(None)
    assigned_to: Optional[str] = Field(None)
    attachments: Optional[list[str]] = Field(None)
    sla_deadline: Optional[datetime] = Field(None)
    is_sla_breached: Optional[bool] = Field(None)
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "title": "Updated: Login Button Not Working",
                "status": "In Progress",
                "priority": "Critical",
                "assigned_to": "agent1"
            }
        }
    )

class CSATSubmitSchema(BaseModel):
    csat_rating: int = Field(..., ge=1, le=5, description="Customer Satisfaction Rating (1-5)")
    csat_feedback: Optional[str] = Field(None, max_length=500, description="Optional feedback text for the rating")


class UserInDB(BaseModel):
    id: PyObjectId = Field(alias="_id", default_factory=ObjectId)
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    hashed_password: str
    role: str = Field(default="user", description="Role of the user: user, agent, or admin")
    projects: list[str] = Field(default_factory=list, description="List of project IDs this user belongs to")
    model_config = ConfigDict(
        json_schema_extra={"example": {"username": "testuser", "email": "test@example.com", "hashed_password": "hash", "role": "user"}},
        populate_by_name=True,
        arbitrary_types_allowed=True
    )

class UpdateProfileSchema(BaseModel):
    email: Optional[EmailStr] = Field(None, description="New email address")
    old_password: Optional[str] = Field(None, description="Required if updating password")
    new_password: Optional[str] = Field(None, min_length=6, description="New password")


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    model_config = ConfigDict(
        json_schema_extra={"example": {"username": "newuser", "email": "new@example.com", "password": "securepassword123"}}
    )

class StaffRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: Literal["agent", "admin"] = Field(..., description="Role to assign: agent or admin")
    staff_code: str = Field(..., description="Secret code required to register as staff")
    model_config = ConfigDict(
        json_schema_extra={"example": {"username": "newagent", "email": "agent@example.com", "password": "securepassword123", "role": "agent", "staff_code": "NOVA2026"}}
    )


class UserOut(BaseModel):
    id: PyObjectId = Field(alias="_id", description="User ID")
    username: str
    email: EmailStr
    role: str
    projects: list[str] = Field(default_factory=list, description="List of project IDs this user belongs to")
    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        arbitrary_types_allowed=True,
        json_schema_extra={"example": {"id": "1a2b3c4d5e6f7a8b9c0d1e2f", "username": "newuser", "email": "new@example.com", "role": "user"}}
    )


class AgentOut(BaseModel):
    username: str
    role: str

class NotificationSchema(BaseModel):
    username: str = Field(..., description="The user to notify")
    message: str = Field(..., description="Notification message content")
    ticket_id: str = Field(..., description="The associated ticket ID")
    is_read: bool = Field(default=False, description="Read status")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationInDB(NotificationSchema):
    id: PyObjectId = Field(default_factory=ObjectId, alias="_id")
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)
