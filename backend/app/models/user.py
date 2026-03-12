import uuid
from enum import Enum as PyEnum
from sqlalchemy import Column, String, Enum, DateTime, func
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class UserRole(PyEnum):
    ADMIN = "admin"
    USER = "user"


class UserStatus(PyEnum):
    PENDING = "pending"
    APPROVED = "approved"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.USER)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.PENDING)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now(), 
        onupdate=func.now()
    )

    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
