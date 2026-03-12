from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.chat import Role


class MessageRead(BaseModel):
    id: UUID
    chat_id: UUID
    role: Role
    content: str
    metadata: Optional[dict[str, Any]] = Field(..., alias="metadata_")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatRead(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatCreate(BaseModel):
    content: str


class SendMessageRequest(BaseModel):
    query: str
    lease_filenames: Optional[list[str]] = None
