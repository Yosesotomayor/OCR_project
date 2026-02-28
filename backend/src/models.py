from sqlalchemy import Column, String, Numeric, Date, Text, Boolean
from .infrastructure.database import Base

class Contract(Base):
    __tablename__ = "contracts"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    status = Column(String, default="processing")
    tenant_name = Column(String, nullable=True)
    monthly_rent = Column(Numeric(precision=12, scale=2), nullable=True)
    currency = Column(String(3), nullable=True)
    expiry_date = Column(Date, nullable=True)
    property_name = Column(String, nullable=True) # New field
    property_zone = Column(String, nullable=True) # New field
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