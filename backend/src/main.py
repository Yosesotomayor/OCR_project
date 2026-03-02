from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import httpx
import uuid
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy import func
from datetime import datetime, timedelta, date
import os
import stripe
import json
import logging
import re

from . import stripe_webhooks
from .infrastructure.database import engine, Base, get_db
from .infrastructure.s3_manager import S3Manager
from .security import (
    get_password_hash, verify_password, create_access_token,
    get_current_active_user, get_current_admin_user, validate_internal_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .models import Contract, User, Chat, ChatMessage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens API Gateway")

origins = ["*"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True, 
    allow_methods=["*"], allow_headers=["*"], expose_headers=["*"]
)

s3 = S3Manager()
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY")

Base.metadata.create_all(bind=engine)

def clean_numeric(value):
    if value is None: return None
    if isinstance(value, (int, float)): return float(value)
    try:
        clean_str = re.sub(r'[^\d.]', '', str(value))
        return float(clean_str)
    except: return None

# --- MODELS ---
class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []
    portfolio_summary: Optional[str] = None
    chat_id: Optional[str] = None

class ChatUpdateTitle(BaseModel):
    title: str

class ChatResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    class Config: from_attributes = True

class MessageResponse(BaseModel):
    role: str
    content: str
    timestamp: datetime
    class Config: from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    is_active: bool
    is_admin: bool
    class Config: from_attributes = True

class ContractUpdate(BaseModel):
    status: str
    progress: Optional[int] = None
    extracted_data: Optional[str] = None
    error_detail: Optional[str] = None

class ContractSchema(BaseModel):
    id: str
    filename: str
    status: str
    progress: int
    tenant_name: Optional[str] = None
    monthly_rent: Optional[float] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None # NUEVO
    expiry_date: Optional[date] = None
    property_name: Optional[str] = None
    property_zone: Optional[str] = None
    s3_key: str
    error_detail: Optional[str] = None
    class Config: from_attributes = True

# --- ENDPOINTS AUTH & CHAT ---
@app.post("/register", response_model=UserResponse)
async def register_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user: raise HTTPException(400, "Email ya registrado")
    new_user = User(id=str(uuid.uuid4()), email=user.email, hashed_password=get_password_hash(user.password))
    if db.query(User).count() == 0: new_user.is_admin = True
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.post("/token", response_model=Token)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(401, "Credenciales incorrectas")
    return {"access_token": create_access_token(data={"sub": user.email}), "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def me(current: User = Depends(get_current_active_user)): return current

@app.get("/chats", response_model=List[ChatResponse])
async def list_chats(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    return db.query(Chat).filter(Chat.user_id == current.id).order_by(Chat.created_at.desc()).all()

@app.get("/chats/{chat_id}/messages", response_model=List[MessageResponse])
async def get_chat_messages(chat_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current.id).first()
    if not chat: raise HTTPException(404)
    return chat.messages

@app.patch("/chats/{chat_id}", status_code=200)
async def update_chat_title(chat_id: str, data: ChatUpdateTitle, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current.id).first()
    if not chat: raise HTTPException(404)
    chat.title = data.title
    db.commit(); return {"status": "ok"}

@app.delete("/chats/{chat_id}", status_code=204)
async def delete_chat(chat_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current.id).first()
    if chat: db.delete(chat); db.commit()

# --- ENDPOINTS CONTRATOS ---
@app.get("/contracts", response_model=List[ContractSchema])
async def list_contracts(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    return db.query(Contract).all()

@app.get("/contracts/{contract_id}/status")
async def get_contract_status(contract_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract: raise HTTPException(404)
    return {"status": db_contract.status, "progress": db_contract.progress, "error_detail": db_contract.error_detail}

@app.get("/contracts/{contract_id}/presigned_url")
async def get_url(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(404)
    url = s3.generate_presigned_url(contract.s3_key)
    return {"presigned_url": url}

@app.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    cid = str(uuid.uuid4())
    content = await file.read()
    key = f"contracts/{cid}/{file.filename}"
    s3.upload_file(content, key)
    contract = Contract(id=cid, filename=file.filename, s3_key=key, status="processing", progress=10)
    db.add(contract); db.commit()
    async with httpx.AsyncClient(timeout=10.0) as client:
        try: await client.post(f"{ML_SERVICE_URL}/process", json={"contract_id": cid, "s3_key": key, "filename": file.filename})
        except: logger.error(f"Fallo conectar ML Service para {cid}")
    return {"contract_id": cid, "status": "processing"}

@app.patch("/contracts/{contract_id}", dependencies=[Depends(validate_internal_token)])
async def update_ml(contract_id: str, update: ContractUpdate, db: Session = Depends(get_db)):
    logger.info(f"📥 PATCH recibido para {contract_id}. Status: {update.status}")
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract: raise HTTPException(404)
    db_contract.status = update.status
    if update.progress is not None: db_contract.progress = update.progress
    db_contract.error_detail = update.error_detail
    if update.extracted_data:
        try:
            data = json.loads(update.extracted_data)
            db_contract.tenant_name = data.get("arrendatario")
            db_contract.monthly_rent = clean_numeric(data.get("monto_renta"))
            db_contract.currency = data.get("moneda")
            db_contract.property_name = data.get("nombre_propiedad")
            db_contract.property_zone = data.get("zona_propiedad")
            # PARSEO DE FECHAS
            if data.get("fecha_inicio"):
                try: db_contract.start_date = datetime.strptime(data["fecha_inicio"], "%Y-%m-%d").date()
                except: pass
            if data.get("fecha_vencimiento"):
                try: db_contract.expiry_date = datetime.strptime(data["fecha_vencimiento"], "%Y-%m-%d").date()
                except: pass
        except: pass
    db.commit(); return {"status": "ok"}

@app.get("/contracts/{contract_id}/exists", dependencies=[Depends(validate_internal_token)])
async def exists(contract_id: str, db: Session = Depends(get_db)):
    if db.query(Contract).filter(Contract.id == contract_id).first(): return {"status":"exists"}
    raise HTTPException(404)

@app.delete("/admin/contracts/{contract_id}", status_code=204)
async def delete_contract(contract_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(status_code=404)
    s3.delete_file(contract.s3_key)
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(f"{ML_SERVICE_URL}/delete-vectors/{contract_id}", headers={"X-Internal-Token": INTERNAL_TOKEN})
    except: pass
    db.delete(contract); db.commit()

@app.get("/analytics/summary")
async def get_analytics_summary(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    now = datetime.now()
    mrr = db.query(func.sum(Contract.monthly_rent)).filter(Contract.status == "completed").scalar() or 0
    exp30 = db.query(Contract).filter(Contract.expiry_date <= now + timedelta(days=30), Contract.expiry_date >= now, Contract.status == "completed").count()
    total = db.query(Contract).count()
    errors = db.query(Contract).filter(Contract.status == "error").count()
    return {
        "total_mrr": float(mrr), "active_contracts": db.query(Contract).filter(Contract.status == "completed").count(),
        "pending_extractions": db.query(Contract).filter(Contract.status == "processing").count(),
        "upcoming_expirations": exp30, "compliance_score": round(100 - (errors/total*100), 1) if total > 0 else 100, "error_count": errors
    }

@app.post("/chat/stream")
async def chat(req: ChatRequest, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    if not req.chat_id:
        chat_id = str(uuid.uuid4())
        new_chat = Chat(id=chat_id, title=req.question[:30] + "...", user_id=current.id)
        db.add(new_chat); db.commit()
    else: chat_id = req.chat_id
    db.add(ChatMessage(id=str(uuid.uuid4()), chat_id=chat_id, role="user", content=req.question))
    db.commit()
    contracts = db.query(Contract).all()
    total_mrr = sum([float(c.monthly_rent or 0) for c in contracts if c.status == "completed"])
    summary = f"SISTEMA LEASELENS - DATOS REALES:\n- TOTAL CONTRATOS: {len(contracts)}\n- MRR TOTAL: {total_mrr} MXN\n"
    for c in contracts: summary += f"* [{c.filename}] {c.tenant_name}, Renta: {c.monthly_rent}, Inicio: {c.start_date}, Vence: {c.expiry_date}\n"
    req.portfolio_summary = summary
    async def stream():
        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                accumulated = ""
                async with client.stream("POST", f"{ML_SERVICE_URL}/query-stream", json=req.dict(), headers={"X-Internal-Token": INTERNAL_TOKEN}) as r:
                    async for chunk in r.aiter_bytes():
                        accumulated += chunk.decode("utf-8")
                        yield chunk
                db.add(ChatMessage(id=str(uuid.uuid4()), chat_id=chat_id, role="assistant", content=accumulated))
                db.commit()
            except: yield "Error de conexion.".encode("utf-8")
    return StreamingResponse(stream(), media_type="text/plain", headers={"X-Chat-ID": chat_id})

@app.get("/admin/users", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    return db.query(User).all()

@app.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(user_id: str, current: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user: db.delete(user); db.commit()
