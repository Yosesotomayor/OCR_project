from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx
import uuid
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy import func
from datetime import timedelta, date
import os
import stripe
import json # Added for json.loads
import logging # Added for logging

from . import stripe_webhooks # Moved this import to the top

from .infrastructure.database import engine, Base, get_db
from .infrastructure.s3_manager import S3Manager
from .security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    validate_internal_token, # Import validate_internal_token
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .models import Contract, User

app = FastAPI(title="LeaseLens API Gateway")
logger = logging.getLogger(__name__) # Instantiate logger


origins = [
    "http://localhost",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

s3 = S3Manager()
ML_SERVICE_URL = "http://ml-service:8000"

Base.metadata.create_all(bind=engine)

app.include_router(stripe_webhooks.router, prefix="/stripe", tags=["Stripe"])

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

# Pydantic Models for Admin User Management
class UserCreateAdmin(UserCreate):
    is_active: bool = True
    is_admin: bool = False

class UserUpdateAdmin(UserBase):
    is_active: bool
    is_admin: bool

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserAdminStatusUpdate(BaseModel):
    is_admin: bool

class UserResponse(UserBase):
    id: str
    is_active: bool
    is_admin: bool
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[date] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_price_id: Optional[str] = None

    class Config:
        from_attributes = True

class SubscriptionUpdate(BaseModel):
    subscription_plan: str
    billing_cycle: str # 'monthly' or 'annually'

class Token(BaseModel):
    access_token: str
    token_type: str

class StripeCheckoutRequest(BaseModel):
    price_id: str
    success_url: str
    cancel_url: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Pydantic Model for Contract Update from ML Service
class ContractUpdate(BaseModel):
    status: str
    extracted_data: Optional[str] = None # Raw JSON string from LLM
    error_detail: Optional[str] = None

# Pydantic Model for Contract Response
class ContractSchema(BaseModel):
    id: str
    filename: str
    status: str
    tenant_name: Optional[str] = None
    monthly_rent: Optional[float] = None # Numeric in SQLAlchemy, float in Pydantic
    currency: Optional[str] = None
    expiry_date: Optional[date] = None
    property_name: Optional[str] = None # New field
    property_zone: Optional[str] = None # New field
    s3_key: str
    error_detail: Optional[str] = None

    class Config:
        from_attributes = True # Formerly orm_mode = True

@app.post("/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(get_db)):
    if not user.email.endswith("@vertiche.mx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten correos de @vertiche.mx"
        )
    
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email ya registrado")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(id=str(uuid.uuid4()), email=user.email, hashed_password=hashed_password)
    
    if db.query(User).count() == 0:
        new_user.is_admin = True

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=Token)
async def login_for_access_token(
    login_data: UserLogin,
    db: Session = Depends(get_db)
):
    try:
        user = db.query(User).filter(User.email == login_data.email).first()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during login: {e}",
        )
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.get("/subscription/me", response_model=UserResponse)
async def read_my_subscription(current_user: User = Depends(get_current_active_user)):
    return current_user

@app.post("/subscription/update", response_model=UserResponse)
async def update_my_subscription(
    subscription_update: SubscriptionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # For simplicity, let's assume a fixed end date for now or calculate based on plan
    # In a real app, this would involve payment processing and more complex logic
    current_user.subscription_plan = subscription_update.subscription_plan
    current_user.subscription_status = "active" # Or based on payment confirmation
    
    # Calculate subscription_end_date based on billing_cycle
    if subscription_update.billing_cycle == "monthly":
        current_user.subscription_end_date = date.today() + timedelta(days=30)
    elif subscription_update.billing_cycle == "annually":
        current_user.subscription_end_date = date.today() + timedelta(days=365)
    else:
        raise HTTPException(status_code=400, detail="Invalid billing cycle")

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/create-checkout-session")
async def create_checkout_session(
    request: StripeCheckoutRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    try:
        # If the user doesn't have a Stripe customer ID, create one
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(email=current_user.email)
            current_user.stripe_customer_id = customer.id
            db.add(current_user)
            db.commit()
            db.refresh(current_user)

        checkout_session = stripe.checkout.Session.create(
            customer=current_user.stripe_customer_id,
            line_items=[
                {
                    'price': request.price_id,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=request.success_url,
            cancel_url=request.cancel_url,
            client_reference_id=current_user.id, # Link to your internal user ID
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Admin User Management Endpoints ---
@app.get("/admin/users", response_model=List[UserResponse])
async def read_all_users(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    return db.query(User).all()

@app.post("/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    user_data: UserCreateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        id=str(uuid.uuid4()),
        email=user_data.email,
        hashed_password=hashed_password,
        is_active=user_data.is_active,
        is_admin=user_data.is_admin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user_admin(
    user_id: str,
    user_data: UserUpdateAdmin,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    db_user.email = user_data.email
    db_user.is_active = user_data.is_active
    db_user.is_admin = user_data.is_admin
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_admin(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    db.delete(db_user)
    db.commit()
    return

@app.patch("/admin/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    status_update: UserStatusUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    db_user.is_active = status_update.is_active
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.patch("/admin/users/{user_id}/admin-status", response_model=UserResponse)
async def update_user_admin_status(
    user_id: str,
    admin_status_update: UserAdminStatusUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    db_user.is_admin = admin_status_update.is_admin
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Document Management Endpoints ---
@app.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    contract_id = str(uuid.uuid4())
    content = await file.read()
    
    s3_key = f"contracts/{contract_id}/{file.filename}"
    s3.upload_file(content, s3_key)

    db_contract = Contract(
        id=contract_id, 
        filename=file.filename, 
        s3_key=s3_key, 
        status="processing"
    )
    db.add(db_contract)
    db.commit()

    async with httpx.AsyncClient() as client:
        await client.post(
            f"{ML_SERVICE_URL}/process",
            json={"contract_id": contract_id, "s3_key": s3_key, "filename": file.filename}
        )

    return {"contract_id": contract_id, "status": "processing"}

@app.get("/contracts/{contract_id}/presigned_url")
async def get_contract_presigned_url(contract_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Generate a presigned URL for the S3 object
    presigned_url = s3.generate_presigned_url(contract.s3_key)
    if not presigned_url:
        raise HTTPException(status_code=500, detail="Could not generate presigned URL")
    
    return {"presigned_url": presigned_url}

@app.patch("/contracts/{contract_id}", response_model=ContractSchema, dependencies=[Depends(validate_internal_token)])
async def update_contract_from_ml(
    contract_id: str,
    contract_update: ContractUpdate,
    db: Session = Depends(get_db)
):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    
    db_contract.status = contract_update.status
    db_contract.error_detail = contract_update.error_detail

    if contract_update.extracted_data:
        # Parse the extracted_data (JSON string) and update relevant fields
        try:
            extracted_json = json.loads(contract_update.extracted_data)
            db_contract.tenant_name = extracted_json.get("arrendatario")
            db_contract.monthly_rent = extracted_json.get("monto_renta")
            db_contract.currency = extracted_json.get("moneda")
            
            # New fields
            db_contract.property_name = extracted_json.get("nombre_propiedad")
            db_contract.property_zone = extracted_json.get("zona_propiedad")

            # Parse expiry_date if present
            expiry_date_str = extracted_json.get("fecha_vencimiento")
            if expiry_date_str:
                try:
                    db_contract.expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
                except ValueError:
                    logger.warning(f"Could not parse expiry_date: {expiry_date_str} for contract {contract_id}")
                    db_contract.error_detail = "Error parsing extracted expiry_date"
                    db_contract.status = "error"

        except json.JSONDecodeError:
            db_contract.error_detail = "Error parsing extracted_data JSON"
            db_contract.status = "error"

    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract

@app.get("/contracts/{contract_id}/status")
async def get_contract_status(contract_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return {"status": db_contract.status, "error_detail": db_contract.error_detail}

@app.post("/chat/stream")
async def stream_chat(request: ChatRequest, current_user: User = Depends(get_current_active_user)):
    """
    Proxy de streaming: Backend recibe chunks del ML-Service y los manda al Frontend.
    """
    async def event_generator():
        internal_api_key = os.getenv("INTERNAL_API_KEY")
        if not internal_api_key:
            logger.error("INTERNAL_API_KEY not set for backend to ML service communication in chat stream.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal API key not configured.")

        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", 
                f"{ML_SERVICE_URL}/query-stream", 
                json=request.dict(),
                headers={"X-Internal-Token": internal_api_key} # Add internal token
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(event_generator(), media_type="text/plain") # Change media_type

@app.get("/contracts/{contract_id}/exists", dependencies=[Depends(validate_internal_token)])
async def check_contract_exists(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="No encontrado")
    return {"status": "exists"}

@app.get("/analytics/summary")
async def get_analytics_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """
    Calcula los KPIs reales para el Dashboard de Inteligencia.
    """
    total_mrr = db.query(func.sum(Contract.monthly_rent)).filter(Contract.status == "completed").scalar() or 0

    active_count = db.query(Contract).filter(Contract.status == "completed").count()
    processing_count = db.query(Contract).filter(Contract.status == "processing").count()
    
    from datetime import datetime, timedelta
    limit_date = datetime.now() + timedelta(days=30)
    upcoming_expirations = db.query(Contract).filter(
        Contract.expiry_date <= limit_date,
        Contract.status == "completed"
    ).count()

    return {
        "total_mrr": float(total_mrr),
        "active_contracts": active_count,
        "pending_extractions": processing_count,
        "upcoming_expirations": upcoming_expirations
    }

@app.get("/contracts")
async def get_all_contracts(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Contract).all()

@app.delete("/admin/contracts/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contract(
    contract_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # Delete from S3
    s3.delete_file(db_contract.s3_key)

    # Delete from Vector DB
    try:
        internal_api_key = os.getenv("INTERNAL_API_KEY")
        if not internal_api_key:
            logger.error("INTERNAL_API_KEY not set for backend to ML service communication.")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal API key not configured.")

        async with httpx.AsyncClient() as client:
            ml_service_url = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")
            await client.delete(
                f"{ml_service_url}/delete-vectors/{contract_id}",
                headers={"X-Internal-Token": internal_api_key}
            )
        logger.info(f"Vectors for contract {contract_id} deleted from vector DB via ML service.")
    except Exception as e:
        logger.error(f"Error calling ML service to delete vectors for contract {contract_id}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete vectors from ML service: {e}")

    # Delete from database
    db.delete(db_contract)
    db.commit()
    return