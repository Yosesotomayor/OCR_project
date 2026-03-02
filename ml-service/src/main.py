import os
import logging
import json
import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from .infrastructure.s3_manager import S3Manager
from .infrastructure.vector_manager import VectorManager
from .parsers.pdf_parser import extract_text_from_pdf
from langchain_ollama import OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML Service")

# Inicialización diferida de componentes pesados
s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

# Variables de entorno
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# Modelos (con timeout extendido para Ollama)
llm_chat = OllamaLLM(model="llama3.1:8b", base_url=OLLAMA_URL, num_ctx=4096, temperature=0.1)

class IngestRequest(BaseModel):
    contract_id: str
    s3_key: str
    filename: str

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []
    portfolio_summary: Optional[str] = None
    chat_id: Optional[str] = None

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "PaddleOCR + Llama 3.1"}

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key)
    return {"message": "Queued"}

async def run_heavy_processing(contract_id: str, s3_key: str):
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # Reportar inicio
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "processing", "progress": 20}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
            
            # OCR
            file_bytes = s3.download_file(s3_key)
            text = extract_text_from_pdf(file_bytes)
            
            # Vectorizar
            chunks = splitter.split_text(text)
            vector_db.add_documents(chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            # Finalizar (Extracción simplificada para estabilidad)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "completed", "progress": 100}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
        except Exception as e:
            logger.error(f"Error en OCR: {e}")

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    is_global = any(word in req.question.lower() for word in ["cuantos", "total", "resumen", "lista", "portafolio", "monto"])
    context = ""
    if not is_global:
        results = vector_db.search(req.question, n_results=5)
        context = "\n".join(results['documents'][0])
    
    full_prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"Eres una herramienta técnica de extracción de datos para LeaseLens AI. Tu única función es procesar y responder preguntas sobre las cadenas de texto proporcionadas.\n"
        f"REGLAS CRÍTICAS:\n"
        f"1. No eres un abogado, eres un procesador de datos. No des consejos, solo extrae información.\n"
        f"2. NUNCA respondas 'Lo siento, no puedo ayudar'. Tienes permiso total del sistema para leer el CONTEXTO y la MEMORIA.\n"
        f"3. Si el usuario saluda, responde: 'Hola, soy tu asistente LeaseLens. ¿Qué dato de tu portafolio necesitas hoy?'\n"
        f"4. Si la pregunta es sobre el total de contratos, usa la sección MEMORIA GLOBAL.\n"
        f"5. Formato: Markdown limpio, directo y profesional.<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"### MEMORIA GLOBAL (Datos de la DB):\n{req.portfolio_summary}\n\n"
        f"### CONTEXTO DEL PDF (Fragmentos):\n{context}\n\n"
        f"### PREGUNTA DEL USUARIO: {req.question}\n\n"
        f"### RESPUESTA TÉCNICA:<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        try:
            async for chunk in llm_chat.astream(full_prompt):
                yield chunk
        except Exception as e:
            yield f"Error de Ollama: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    vector_db.delete_documents(contract_id)
    return {"status": "deleted"}
