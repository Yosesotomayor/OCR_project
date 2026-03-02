import os
import logging
import json
import httpx
import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from .infrastructure.s3_manager import S3Manager
from .infrastructure.vector_manager import VectorManager
from .parsers.pdf_parser import extract_text_from_pdf
from langchain_ollama import OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Configuración de logs detallada
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML Engine v2.8")

s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# Motor IA - Usamos un timeout más corto y un contexto optimizado para extracción
llm = OllamaLLM(
    model="llama3.2:3b", 
    base_url=OLLAMA_URL, 
    num_ctx=2048, # Reducido para mayor velocidad
    temperature=0.0,
    timeout=60.0
)

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
async def health(): return {"status": "ok"}

async def safe_patch(contract_id: str, payload: dict):
    async with httpx.AsyncClient(timeout=10.0) as client:
        for i in range(3):
            try:
                r = await client.patch(
                    f"{BACKEND_URL}/contracts/{contract_id}", 
                    json=payload, 
                    headers={"X-Internal-Token": INTERNAL_TOKEN}
                )
                if r.status_code == 200: return True
                logger.error(f"Error en patch ({r.status_code}): {r.text}")
            except Exception as e:
                logger.warning(f"Retry {i+1} para {contract_id}: {e}")
                await asyncio.sleep(1)
    return False

async def run_heavy_processing(contract_id: str, s3_key: str):
    try:
        # 1. OCR (20%)
        logger.info(f"🚀 Iniciando OCR para {contract_id}")
        await safe_patch(contract_id, {"status": "processing", "progress": 20})
        file_bytes = await asyncio.to_thread(s3.download_file, s3_key)
        text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
        
        # 2. Vectorización (40%)
        logger.info(f"📚 Vectorizando {contract_id}")
        await safe_patch(contract_id, {"status": "processing", "progress": 40})
        chunks = splitter.split_text(text)
        await asyncio.to_thread(vector_db.add_documents, chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

        # 3. Extracción IA (80%)
        await safe_patch(contract_id, {"status": "processing", "progress": 80})
        logger.info(f"🤖 Extrayendo metadatos IA para {contract_id}")
        
        # Usamos un fragmento más pequeño para asegurar velocidad
        context_text = text[:6000]
        prompt = (
            f"### INSTRUCCIÓN: Extrae la información del contrato y responde ÚNICAMENTE con un objeto JSON.\n"
            f"### CAMPOS REQUERIDOS: arrendatario, monto_renta (solo número), moneda (ej. MXN), fecha_inicio (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), zona_propiedad.\n"
            f"### CONTRATO:\n{context_text}\n\n"
            f"### JSON:"
        )
        
        # 85% - Esperando a la IA
        await safe_patch(contract_id, {"status": "processing", "progress": 85})
        resp = await llm.ainvoke(prompt)
        
        # 90% - Procesando respuesta
        await safe_patch(contract_id, {"status": "processing", "progress": 90})
        logger.info(f"Respuesta IA para {contract_id}: {resp}")
        
        final_data = {}
        try:
            clean = resp.strip()
            start = clean.find("{")
            end = clean.rfind("}")
            if start != -1 and end != -1:
                final_data = json.loads(clean[start:end+1])
        except Exception as e:
            logger.error(f"Error parseando JSON de IA: {e}")

        # 4. Finalizado (100%)
        logger.info(f"✅ Finalizando proceso para {contract_id}")
        await safe_patch(contract_id, {"status": "processing", "progress": 95})
        
        success = await safe_patch(contract_id, {
            "status": "completed", 
            "progress": 100, 
            "extracted_data": json.dumps(final_data)
        })
        
        if not success:
            logger.error(f"❌ No se pudo marcar como completado en backend para {contract_id}")
        
    except Exception as e:
        logger.error(f"💥 Error crítico: {e}")
        await safe_patch(contract_id, {"status": "error", "progress": 0, "error_detail": str(e)})

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key)
    return {"message": "Queued"}

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    q = req.question.lower()
    is_trivial = any(w in q for w in ["hola", "buenos dias", "quien eres", "gracias"])
    
    context = ""
    if not is_trivial:
        try:
            results = await asyncio.to_thread(vector_db.search, req.question, n_results=3)
            context = "\n".join(results['documents'][0])
        except: pass
    
    full_prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"Eres LeaseLens AI. Responde usando el PORTAFOLIO y CONTEXTO.<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"PORTAFOLIO: {req.portfolio_summary}\n"
        f"CONTEXTO: {context}\n"
        f"PREGUNTA: {req.question}<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        async for chunk in llm.astream(full_prompt): yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    await asyncio.to_thread(vector_db.delete_documents, contract_id)
    return {"status": "deleted"}
