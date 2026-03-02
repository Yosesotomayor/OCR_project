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

# --- ÚNICA CONFIGURACIÓN DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
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
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    property_name: Optional[str] = None
    property_zone: Optional[str] = None
    s3_key: str
    error_detail: Optional[str] = None
    class Config: from_attributes = True

# --- AUTH ---
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

# --- CHAT ---
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

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    try:
        chat_id = req.chat_id
        
        # VALIDACIÓN DE SEGURIDAD: Verificar si el chat_id existe realmente en la DB
        active_chat = None
        if chat_id:
            active_chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == current.id).first()
        
        # Si no existe o no se proporcionó, crear uno nuevo
        if not active_chat:
            chat_id = str(uuid.uuid4())
            active_chat = Chat(id=chat_id, title=req.question[:30] + "...", user_id=current.id)
            db.add(active_chat)
            db.commit() # Asegurar existencia física
            db.refresh(active_chat)
        
        # Ahora es seguro insertar el mensaje
        user_msg = ChatMessage(id=str(uuid.uuid4()), chat_id=chat_id, role="user", content=req.question)
        db.add(user_msg)
        db.commit()

        # 3. Preparar Resumen del Portafolio
        contracts = db.query(Contract).all()
        summary = f"PORTAFOLIO: {len(contracts)} contratos.\n"
        for c in contracts:
            summary += f"- {c.filename}: {c.tenant_name}, Rent: {c.monthly_rent}\n"
        req.portfolio_summary = summary

        async def stream_generator():
            async with httpx.AsyncClient(timeout=300.0) as client:
                accumulated = ""
                try:
                    async with client.stream("POST", f"{ML_SERVICE_URL}/query-stream", json=req.dict(), headers={"X-Internal-Token": INTERNAL_TOKEN}) as r:
                        if r.status_code != 200:
                            yield f"Error IA (Status {r.status_code})".encode("utf-8")
                            return
                        async for chunk in r.aiter_bytes():
                            accumulated += chunk.decode("utf-8")
                            yield chunk
                    
                    # Guardar respuesta al final (Usando el motor directamente para evitar hilos cerrados)
                    if accumulated:
                        with Session(engine) as save_db:
                            save_db.add(ChatMessage(id=str(uuid.uuid4()), chat_id=chat_id, role="assistant", content=accumulated))
                            save_db.commit()
                except Exception as e:
                    yield f"Error de enlace: {str(e)}".encode("utf-8")

        return StreamingResponse(stream_generator(), media_type="text/plain", headers={"X-Chat-ID": chat_id})
    except Exception as e:
        logger.error(f"FALLO CRITICO: {e}")
        raise HTTPException(500, detail=str(e))

# --- CONTRACTS & ANALYTICS (Mantenidos) ---
@app.get("/contracts", response_model=List[ContractSchema])
async def list_contracts(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)): 
    return db.query(Contract).all()

@app.get("/contracts/{contract_id}/status")
async def get_contract_status(contract_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract: raise HTTPException(404)
    return {"status": db_contract.status, "progress": db_contract.progress, "error_detail": db_contract.error_detail}

@app.get("/analytics/summary")
async def analytics(db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    mrr = db.query(func.sum(Contract.monthly_rent)).scalar() or 0
    active = db.query(Contract).filter(Contract.status == "completed").count()
    upcoming = db.query(Contract).count() # Simulación
    
    # Datos de gráficas (Mock si no hay datos reales suficientes)
    return {
        "total_mrr": float(mrr), "active_contracts": active, "upcoming_expirations": 0, "compliance_score": 100,
        "revenue_by_zone": [{"name": "Norte", "value": float(mrr)}],
        "expirations_timeline": [{"month": "Mar 26", "count": 1}]
    }

@app.get("/contracts/{contract_id}/presigned_url")
async def get_url(contract_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(404)
    return {"presigned_url": s3.generate_presigned_url(contract.s3_key)}

@app.delete("/admin/contracts/{contract_id}", status_code=204)
async def delete_contract(contract_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    """
    Elimina un contrato, su archivo en S3 y sus vectores asociados.
    """
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract: raise HTTPException(404)
    
    # 1. Eliminar de S3
    s3.delete_file(contract.s3_key)
    
    # 2. Notificar al ML Service para limpiar vectores
    try:
        async with httpx.AsyncClient() as client:
            await client.delete(f"{ML_SERVICE_URL}/delete-vectors/{contract_id}", headers={"X-Internal-Token": INTERNAL_TOKEN})
    except:
        logger.warning(f"No se pudieron eliminar los vectores para {contract_id}")

    # 3. Eliminar de DB
    db.delete(contract)
    db.commit()
    return None

@app.post("/upload")
async def upload(file: UploadFile = File(...), db: Session = Depends(get_db), current: User = Depends(get_current_active_user)):
    cid = str(uuid.uuid4())
    content = await file.read()
    key = f"contracts/{cid}/{file.filename}"
    s3.upload_file(content, key)
    contract = Contract(id=cid, filename=file.filename, s3_key=key, status="processing", progress=10)
    db.add(contract); db.commit()
    async with httpx.AsyncClient() as client:
        await client.post(f"{ML_SERVICE_URL}/process", json={"contract_id": cid, "s3_key": key, "filename": file.filename})
    return {"contract_id": cid}

@app.get("/admin/logs")
async def get_system_logs(current: User = Depends(get_current_admin_user)):
    """
    Simula la lectura de logs del sistema en tiempo real.
    """
    import datetime
    t = datetime.datetime.now().strftime("%H:%M:%S")
    logs = [
        f"[{t}] [SYS] Monitor de GPU: Activo (VRAM 8GB free)",
        f"[{t}] [API] 200 POST /chat/stream - User: {current.email}",
        f"[{t}] [S3] Heartbeat Minio: OK",
        f"[{t}] [DB] Query optimizada en pgvector (0.04ms)",
        f"[{t}] [AI] Llama 3.1 en modo analista listo."
    ]
    return {"logs": "\n".join(logs)}

@app.get("/admin/system/status")
async def get_system_status(db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    """
    Consola de Comando: Telemetría real del sistema.
    """
    # 1. Telemetría de Base de Datos
    user_count = db.query(User).count()
    contract_count = db.query(Contract).count()
    completed_ocr = db.query(Contract).filter(Contract.status == "completed").count()
    
    # 2. Verificar Salud de Microservicios
    agents_status = "OFFLINE"
    vram_usage = "N/A"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            # Salud de ML Service
            ml_resp = await client.get(f"{ML_SERVICE_URL}/health")
            if ml_resp.status_code == 200:
                agents_status = "OPERATIVO"
            
            # Consultar Ollama directamente para ver modelos en VRAM
            # (Asumiendo que ollama está accesible desde el backend o via proxy ml)
            ollama_resp = await client.get("http://ollama:11434/api/ps")
            if ollama_resp.status_code == 200:
                models = ollama_resp.json().get("models", [])
                if models:
                    vram_usage = ", ".join([f"{m['name']} ({round(m['size']/(1024**3), 2)}GB)" for m in models])
                else:
                    vram_usage = "0GB (Models on Standby)"
    except:
        agents_status = "ML_SERVICE_UNREACHABLE"

    return {
        "metrics": {
            "usuarios": user_count,
            "contratos_totales": contract_count,
            "ocr_exitosos": completed_ocr,
            "vram_active_models": vram_usage
        },
        "agents": agents_status,
        "routes": [f"{list(r.methods)[0]} {r.path}" for r in app.routes if hasattr(r, "methods")]
    }

# --- ADMIN USER MANAGEMENT ---
@app.get("/admin/users", response_model=List[UserResponse])
async def list_users(db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    return db.query(User).all()

@app.post("/admin/users", response_model=UserResponse)
async def create_user_admin(data: UserLogin, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    db_user = db.query(User).filter(User.email == data.email).first()
    if db_user: raise HTTPException(400, "Email ya registrado")
    new_user = User(id=str(uuid.uuid4()), email=data.email, hashed_password=get_password_hash(data.password))
    db.add(new_user); db.commit(); db.refresh(new_user)
    return new_user

@app.put("/admin/users/{user_id}", response_model=UserResponse)
async def update_user_admin(user_id: str, data: UserResponse, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404, "Usuario no encontrado")
    user.email = data.email
    user.is_active = data.is_active
    user.is_admin = data.is_admin
    db.commit(); db.refresh(user)
    return user

@app.patch("/admin/users/{user_id}/status", response_model=UserResponse)
async def patch_user_status(user_id: str, data: dict, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404)
    if "is_active" in data: user.is_active = data["is_active"]
    db.commit(); db.refresh(user)
    return user

@app.patch("/admin/users/{user_id}/admin-status", response_model=UserResponse)
async def patch_user_admin_status(user_id: str, data: dict, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user: raise HTTPException(404)
    if "is_admin" in data: user.is_admin = data["is_admin"]
    db.commit(); db.refresh(user)
    return user

@app.delete("/admin/users/{user_id}", status_code=204)
async def delete_user(user_id: str, db: Session = Depends(get_db), current: User = Depends(get_current_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if user: db.delete(user); db.commit()

@app.patch("/contracts/{contract_id}", dependencies=[Depends(validate_internal_token)])
async def update_ml(contract_id: str, update: ContractUpdate, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == contract_id).first()
    if not c: raise HTTPException(404)
    
    # Actualización de estado básico
    c.status = update.status
    if update.progress is not None: 
        c.progress = update.progress
    if update.error_detail:
        c.error_detail = update.error_detail
    
    # Procesar extracción IA
    if update.extracted_data:
        try:
            data = json.loads(update.extracted_data)
            c.tenant_name = data.get("arrendatario")
            c.monthly_rent = clean_numeric(data.get("monto_renta"))
            c.currency = data.get("moneda")
            c.property_name = data.get("nombre_propiedad")
            c.property_zone = data.get("zona_propiedad")
            
            # Parseo robusto de fechas (YYYY-MM-DD)
            for date_field in ["fecha_inicio", "fecha_vencimiento"]:
                val = data.get(date_field)
                if val and isinstance(val, str):
                    try:
                        parsed_date = datetime.strptime(val, "%Y-%m-%d").date()
                        if date_field == "fecha_inicio": c.start_date = parsed_date
                        else: c.expiry_date = parsed_date
                    except:
                        logger.warning(f"Formato de fecha inválido para {date_field}: {val}")
        except Exception as e:
            logger.error(f"Error procesando extracted_data: {e}")
    
    db.commit()
    return {"ok": True}
