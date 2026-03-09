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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML Engine v2.9")

s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

llm = OllamaLLM(
    model="llama3.2:3b", 
    base_url=OLLAMA_URL, 
    num_ctx=4096, 
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
        for i in range(2):
            try:
                r = await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json=payload, headers={"X-Internal-Token": INTERNAL_TOKEN})
                if r.status_code == 200: return True
            except:
                await asyncio.sleep(1)
    return False

async def run_heavy_processing(contract_id: str, s3_key: str):
    try:
        await safe_patch(contract_id, {"status": "processing", "progress": 20})
        file_bytes = await asyncio.to_thread(s3.download_file, s3_key)
        text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
        
        await safe_patch(contract_id, {"status": "processing", "progress": 40})
        chunks = splitter.split_text(text)
        await asyncio.to_thread(vector_db.add_documents, chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

        await safe_patch(contract_id, {"status": "processing", "progress": 80})
        
        input_data = text[:12000]
        prompt = (
            f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
            f"Eres un experto en auditoría legal. Extrae datos financieros y fechas de este contrato.\n"
            f"REGLAS DE ORO:\n"
            f"1. FECHAS: Busca 'vigencia', 'plazo' o 'duración'. Si no hay fecha explícita de inicio, usa la fecha de firma del contrato.\n"
            f"2. FORMATO: Usa estrictamente YYYY-MM-DD.\n"
            f"3. UBICACIÓN: Para 'property_zone', extrae la Entidad Federativa (Estado) (ej: Querétaro, Jalisco, CDMX). Ignora calles y colonias.\n"
            f"4. SCHEMA: Responde con este JSON exacto:\n"
            f"{{\n"
            f"  \"tenant_name\": \"string\",\n"
            f"  \"monthly_rent\": number,\n"
            f"  \"currency\": \"MXN/USD\",\n"
            f"  \"start_date\": \"YYYY-MM-DD\",\n"
            f"  \"expiry_date\": \"YYYY-MM-DD\",\n"
            f"  \"property_name\": \"string\",\n"
            f"  \"property_zone\": \"Entidad Federativa\"\n"
            f"}}\n"
            f"5. Responde ÚNICAMENTE con el objeto JSON.<|eot_id|>\n"
            f"<|start_header_id|>user<|end_header_id|>\n\n"
            f"TEXTO DEL CONTRATO:\n{input_data}<|eot_id|>\n"
            f"<|start_header_id|>assistant<|end_header_id|>\n\n"
            f"{{"
        )
        
        # Forzamos que la respuesta empiece con '{' para guiar al modelo
        resp_raw = await llm.ainvoke(prompt)
        resp = "{" + resp_raw if not resp_raw.strip().startswith("{") else resp_raw
        
        final_data = {}
        try:
            clean = resp.strip()
            start = clean.find("{")
            end = clean.rfind("}")
            if start != -1 and end != -1:
                final_data = json.loads(clean[start:end+1])
        except:
            logger.error(f"Fallo parsing JSON para {contract_id}")

        await safe_patch(contract_id, {
            "status": "completed", 
            "progress": 100, 
            "extracted_data": json.dumps(final_data)
        })
        
    except Exception as e:
        logger.error(f"Error fatal: {e}")
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
        f"Eres LeaseLens AI, socio de inteligencia inmobiliaria. Responde de forma formal y ejecutiva.\n"
        f"Usa el PORTAFOLIO y el CONTEXTO DOC proporcionados. No alucines datos. Si no sabes un dato estrictamente di que no sabes!<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"### PORTAFOLIO: {req.portfolio_summary}\n"
        f"### CONTEXTO DOC: {context}\n"
        f"### PREGUNTA: {req.question}<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        async for chunk in llm.astream(full_prompt): yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    await asyncio.to_thread(vector_db.delete_documents, contract_id)
    return {"status": "deleted"}
