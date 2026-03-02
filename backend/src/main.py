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

from . import stripe_webhooks
from .infrastructure.database import engine, Base, get_db
from .infrastructure.s3_manager import S3Manager
from .security import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_active_user,
    get_current_admin_user,
    validate_internal_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from .models import Contract, User

app = FastAPI(title="LeaseLens API Gateway")
logger = logging.getLogger(__name__)

origins = ["*"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

s3 = S3Manager()
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://ml-service:8000")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY")

Base.metadata.create_all(bind=engine)

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []
    portfolio_summary: Optional[str] = None

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
    extracted_data: Optional[str] = None

class ContractSchema(BaseModel):
    id: str
    filename: str
    status: str
    tenant_name: Optional[str] = None
    monthly_rent: Optional[float] = None
    currency: Optional[str] = None
    expiry_date: Optional[date] = None
    property_name: Optional[str] = None
    property_zone: Optional[str] = None
    s3_key: str
    error_detail: Optional[str] = None
    class Config: from_attributes = True

@app.post("/register", response_model=UserResponse)
async def register_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user: raise HTTPException(status_code=400, detail="Email ya registrado")
    new_user = User(id=str(uuid.uuid4()), email=user.email, hashed_password=get_password_hash(user.password))
    if db.query(User).count() == 0: new_user.is_admin = True
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.post("/token", response_model=Token)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return {"access_token": create_access_token(data={"sub": user.email}), "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
async def me(current: User = Depends(get_current_active_user)): return current

@app.get("/contracts", response_model=List[ContractSchema])
async def list_contracts(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    return db.query(Contract).all()

@app.get("/contracts/{contract_id}/presigned_url")
async def get_url(contract_id: str, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(status_code=404)
    url = s3.generate_presigned_url(contract.s3_key)
    return {"presigned_url": url.replace("http://minio:9000", "http://localhost:9000")}

@app.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    cid = str(uuid.uuid4())
    content = await file.read()
    key = f"contracts/{cid}/{file.filename}"
    s3.upload_file(content, key)
    db_contract = Contract(id=cid, filename=file.filename, s3_key=key, status="processing")
    db.add(db_contract); db.commit()
    async with httpx.AsyncClient() as client:
        await client.post(f"{ML_SERVICE_URL}/process", json={"contract_id": cid, "s3_key": key, "filename": file.filename})
    return {"contract_id": cid}

@app.patch("/contracts/{contract_id}", dependencies=[Depends(validate_internal_token)])
async def update_ml(contract_id: str, update: ContractUpdate, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(status_code=404)
    contract.status = update.status
    if update.extracted_data:
        try:
            data = json.loads(update.extracted_data)
            contract.tenant_name = data.get("arrendatario")
            contract.monthly_rent = data.get("monto_renta")
            contract.currency = data.get("moneda")
            contract.property_name = data.get("nombre_propiedad")
            contract.property_zone = data.get("zona_propiedad")
            if data.get("fecha_vencimiento"):
                try: contract.expiry_date = datetime.strptime(data["fecha_vencimiento"], "%Y-%m-%d").date()
                except: pass
        except: pass
    db.commit(); return {"status": "ok"}

@app.get("/contracts/{contract_id}/exists", dependencies=[Depends(validate_internal_token)])
async def exists(contract_id: str, db: Session = Depends(get_db)):
    if db.query(Contract).filter(Contract.id == contract_id).first(): return {"status":"exists"}
    raise HTTPException(404)

@app.get("/analytics/summary")
async def get_analytics_summary(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    now = datetime.now()
    mrr = db.query(func.sum(Contract.monthly_rent)).filter(Contract.status == "completed").scalar() or 0
    exp30 = db.query(Contract).filter(Contract.expiry_date <= now + timedelta(days=30), Contract.expiry_date >= now).count()
    total = db.query(Contract).count()
    errors = db.query(Contract).filter(Contract.status == "error").count()
    return {
        "total_mrr": float(mrr),
        "active_contracts": db.query(Contract).filter(Contract.status == "completed").count(),
        "pending_extractions": db.query(Contract).filter(Contract.status == "processing").count(),
        "upcoming_expirations": exp30,
        "compliance_score": round(100 - (errors/total*100), 1) if total > 0 else 100,
        "error_count": errors
    }

@app.post("/chat/stream")
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    cs = db.query(Contract).all()
    summary = f"PORTAFOLIO: Tienes {len(cs)} contratos. " + ", ".join([f"{c.filename} ({c.tenant_name})" for c in cs])
    req.portfolio_summary = summary
    async def stream():
        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                async with client.stream("POST", f"{ML_SERVICE_URL}/query-stream", json=req.dict(), headers={"X-Internal-Token": INTERNAL_TOKEN}) as r:
                    if r.status_code != 200:
                        yield b"⚠️ El servicio de ML esta procesando. Por favor reintenta en unos segundos."
                        return
                    async for chunk in r.aiter_bytes(): yield chunk
            except httpx.ReadTimeout:
                yield b"⚠️ Tiempo de espera agotado. La GPU esta bajo mucha carga."
    return StreamingResponse(stream(), media_type="text/plain")

@app.get("/admin/users", response_model=List[UserResponse])
async def list_users(current: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    return db.query(User).all()

@app.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(user_id: str, current: User = Depends(get_current_admin_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if user: db.delete(user); db.commit()
