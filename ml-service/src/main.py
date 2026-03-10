import os
import logging
import json
import httpx
import asyncio
import re
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from .infrastructure.s3_manager import S3Manager
from .infrastructure.vector_manager import VectorManager
from .parsers.pdf_parser import extract_text_from_pdf
from langchain_ollama import OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML Engine v4.8 - Hybrid Chat")

s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)
ai_semaphore = asyncio.Semaphore(1)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# CEREBRO 1: Extractor (Formato JSON estricto)
extractor_llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url=OLLAMA_URL, 
    num_ctx=16384, 
    temperature=0.0, 
    format="json", 
    timeout=300.0
)

# CEREBRO 2: Analista (Conversacional, sin formato JSON)
analyst_llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url=OLLAMA_URL, 
    num_ctx=16384,
    temperature=0.7, # Más creativo para conversar
    timeout=120.0
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
    async with httpx.AsyncClient(timeout=25.0) as client:
        for i in range(2):
            try:
                r = await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json=payload, headers={"X-Internal-Token": INTERNAL_TOKEN})
                if r.status_code == 200: return True
            except:
                await asyncio.sleep(1)
    return False

async def run_heavy_processing(contract_id: str, s3_key: str):
    async with ai_semaphore:
        try:
            logger.info(f"==> Iniciando contrato {contract_id}")
            await safe_patch(contract_id, {"status": "processing", "progress": 20})
            file_bytes = await asyncio.to_thread(s3.download_file, s3_key)
            text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
            
            # Cálculo de metadatos estructurales
            total_pages = len(re.findall(r"=== INICIO PÁGINA \d+", text))
            # Contar cláusulas (buscamos palabras en mayúsculas seguidas de punto o números romanos)
            clauses = re.findall(r"(CLÁUSULA|CLAUSULA|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA)", text, re.IGNORECASE)
            clause_count = len(set(clauses)) # Usamos set para evitar duplicados por OCR

            await safe_patch(contract_id, {"status": "processing", "progress": 50})
            chunks = splitter.split_text(text)
            await asyncio.to_thread(vector_db.add_documents, chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            await safe_patch(contract_id, {"status": "processing", "progress": 80})
            
            prompt = (
                f"Extract lease contract data from the following text into a FLAT JSON object.\n"
                f"REQUIRED FIELDS: tenant_name, monthly_rent, currency, start_date, expiry_date, property_zone.\n"
                f"ADDITIONAL: total_pages: {total_pages}, clause_count: {clause_count}\n"
                f"TEXT:\n{text[:45000]}"
            )
            
            resp_raw = await extractor_llm.ainvoke(prompt)
            final_data = json.loads(resp_raw)
            
            # Asegurar que los conteos estructurales se incluyan
            final_data["total_pages"] = total_pages
            final_data["clause_count"] = clause_count

            await safe_patch(contract_id, {
                "status": "completed", 
                "progress": 100, 
                "extracted_data": json.dumps(final_data)
            })
            
        except Exception as e:
            logger.error(f"Fatal Error {contract_id}: {e}")
            await safe_patch(contract_id, {"status": "error", "progress": 0, "error_detail": str(e)})

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key)
    return {"message": "Queued"}

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    search_filter = None
    target_info = ""
    n_to_retrieve = 6 # Por defecto 6 fragmentos
    
    if req.portfolio_summary:
        contract_matches = re.findall(r"- (.*?): (.*?), Rent: .*? \(ID: (.*?)\)", req.portfolio_summary)
        for filename, tenant, cid in contract_matches:
            # Quitamos el .pdf para un match más natural
            clean_name = filename.replace(".pdf", "").lower()
            if clean_name in req.question.lower() or tenant.lower() in req.question.lower():
                search_filter = {"doc_id": cid}
                target_info = f"(Analizando a profundidad: {filename})"
                n_to_retrieve = 15 # Leemos casi todo el contrato si es específico
                break

    results = await asyncio.to_thread(vector_db.search, req.question, n_results=n_to_retrieve, filter=search_filter)
    local_context = "\n".join(results['documents'][0])
    
    full_prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"Eres LeaseLens AI, Senior Analyst. {target_info}\n"
        f"INSTRUCCIONES DE BÚSQUEDA:\n"
        f"1. Si te preguntan por el 'Destino', 'Giro' o 'Uso', busca en las cláusulas de 'Objeto' o 'Uso de local'.\n"
        f"2. Sé preciso y cita brevemente la cláusula si es posible.\n"
        f"3. Responde de forma profesional y ejecutiva.\n\n"
        f"### RESUMEN DE PORTAFOLIO:\n{req.portfolio_summary}\n\n"
        f"### CONTEXTO DEL DOCUMENTO:\n{local_context}<|eot_id|>"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"{req.question}<|eot_id|>"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        async for chunk in analyst_llm.astream(full_prompt): yield chunk
    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    await asyncio.to_thread(vector_db.delete_documents, contract_id)
    return {"status": "deleted"}
