from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Security, status, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from sqlalchemy.orm import Session
import httpx, uuid, json
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Annotated
from sqlalchemy import func
from decimal import Decimal
from fastapi.security import OAuth2PasswordRequestForm # Added this import

from .infrastructure.database import engine, Base, get_db
from .infrastructure.s3_manager import S3Manager
from .security import (
    validate_internal_token,
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .utils import extract_json_from_text, safe_decimal
from .models import Contract, User # Import User model

app = FastAPI(title="LeaseLens API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # TODO: En producción cambia esto por la URL de tu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

s3 = S3Manager()
ML_SERVICE_URL = "http://ml-service:8000"

Base.metadata.create_all(bind=engine)

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []

# Pydantic models for User authentication
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    is_active: bool
    is_admin: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

# --- User Authentication Endpoints ---
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
    
    # Make the first registered user an admin
    if db.query(User).count() == 0:
        new_user.is_admin = True

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
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

@app.get("/admin/users", response_model=List[UserResponse])
async def read_all_users(current_user: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    return db.query(User).all()

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

@app.post("/chat/stream")
async def stream_chat(request: ChatRequest, current_user: User = Depends(get_current_active_user)):
    """
    Proxy de streaming: Backend recibe chunks del ML-Service y los manda al Frontend.
    """
    async def event_generator():
        async with httpx.AsyncClient(timeout=None) as client:

            async with client.stream(
                "POST", 
                f"{ML_SERVICE_URL}/query-stream", 
                json=request.dict()
            ) as response:
                async for chunk in response.aiter_bytes():
                    yield chunk

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/contracts/{contract_id}/exists")
async def check_contract_exists(contract_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
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