from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    role: UserRole | None = None
    status: UserStatus | None = None


class User(UserBase):
    id: UUID
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserInDB(User):
    hashed_password: str
