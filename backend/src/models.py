from sqlalchemy import Column, String, Numeric, Date, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .infrastructure.database import Base
from datetime import datetime

class Contract(Base):
    __tablename__ = "contracts"
    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    status = Column(String, default="processing")
    tenant_name = Column(String, nullable=True)
    monthly_rent = Column(Numeric(precision=12, scale=2), nullable=True)
    currency = Column(String(3), nullable=True)
    expiry_date = Column(Date, nullable=True)
    property_name = Column(String, nullable=True)
    property_zone = Column(String, nullable=True)
    s3_key = Column(String, nullable=False)
    error_detail = Column(Text, nullable=True)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    subscription_plan = Column(String, nullable=True)
    subscription_status = Column(String, nullable=True)
    subscription_end_date = Column(Date, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    stripe_price_id = Column(String, nullable=True)
    
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, ForeignKey("users.id"))
    
    user = relationship("User", back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, index=True)
    chat_id = Column(String, ForeignKey("chats.id"))
    role = Column(String, nullable=False) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    chat = relationship("Chat", back_populates="messages")
