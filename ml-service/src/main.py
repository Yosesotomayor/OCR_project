import os
import logging
from fastapi import FastAPI, BackgroundTasks, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional

from .infrastructure.s3_manager import S3Manager
from .infrastructure.vector_manager import VectorManager
from .parsers.pdf_parser import extract_text_from_pdf

from langchain_ollama import OllamaLLM
from langchain_text_splitters import RecursiveCharacterTextSplitter
import httpx
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML-Service")

s3 = S3Manager()
vector_db = VectorManager()

# --- AGENTES ESPECIALIZADOS ---
llm_chat = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=4096, temperature=0.7)
llm_extractor = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=4096, temperature=0.1)
llm_validator = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=4096, temperature=0.1)

@app.on_event("startup")
async def warmup():
    try:
        llm_chat.invoke("Hi")
        logger.info("✅ Multi-Agentes listos.")
    except: pass

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
logger.info(f"🔑 Internal Token configurado: {'*' * len(INTERNAL_TOKEN)}")
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

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
async def health_check(): return {"status": "ok"}

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):
    logger.info(f"⚙️ Procesando: {contract_id} ({filename})")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # 1. OCR (20%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "processing", "progress": 20}, headers={"X-Internal-Token": INTERNAL_TOKEN})
            file_bytes = s3.download_file(s3_key)
            if not file_bytes: return
            text = extract_text_from_pdf(file_bytes)
            
            # 2. Vectorizacion (40%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "processing", "progress": 40}, headers={"X-Internal-Token": INTERNAL_TOKEN})
            chunks = splitter.split_text(text)
            vector_db.add_documents(chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            # 3. Extraccion (70%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "processing", "progress": 70}, headers={"X-Internal-Token": INTERNAL_TOKEN})
            pages = text.split("--- PÁGINA")
            raw_data = {}
            target_fields = ["monto_renta", "moneda", "arrendatario", "fecha_inicio", "fecha_vencimiento", "zona_propiedad", "nombre_propiedad"]
            
            for i, page_content in enumerate(pages[:15]):
                if not page_content.strip(): continue
                extract_prompt = (
                    f"### TAREA: Extrae datos del contrato en JSON.\n"
                    f"### CAMPOS: monto_renta (num), moneda, arrendatario, fecha_inicio (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), zona_propiedad, nombre_propiedad.\n"
                    f"### TEXTO:\n{page_content[:3500]}\n\n"
                    f"### RESPUESTA (SOLO JSON):"
                )
                resp = llm_extractor.invoke(extract_prompt)
                try:
                    clean = resp.strip()
                    if "{" in clean:
                        data = json.loads(clean[clean.find("{"):clean.rfind("}")+1])
                        for k in target_fields:
                            if data.get(k) and not raw_data.get(k):
                                raw_data[k] = data[k]
                except: continue

            # 4. Validacion (90%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "processing", "progress": 90}, headers={"X-Internal-Token": INTERNAL_TOKEN})
            validation_prompt = (
                f"### SISTEMA: Auditor Legal.\n"
                f"### TEXTO:\n{text[:5000]}\n\n"
                f"### DATOS:\n{json.dumps(raw_data)}\n\n"
                f"### TAREA: Corrige montos y fechas (inicio y vencimiento).\n"
                f"### RESPUESTA (SOLO JSON FINAL):"
            )
            validated_resp = llm_validator.invoke(validation_prompt)
            final_json = raw_data
            try:
                clean_v = validated_resp.strip()
                if "{" in clean_v:
                    final_json = json.loads(clean_v[clean_v.find("{"):clean_v.rfind("}")+1])
            except: pass

            # 5. Finalizado (100%)
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "progress": 100, "extracted_data": json.dumps(final_json)},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            logger.info(f"✅ Finalizado: {contract_id}")

        except Exception as e:
            logger.error(f"💥 Error: {str(e)}")
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "progress": 0, "error_detail": str(e)}, headers={"X-Internal-Token": INTERNAL_TOKEN})

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key, req.filename)
    return {"message": "Queued"}

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    is_global = any(word in req.question.lower() for word in ["cuantos", "total", "resumen", "lista", "portafolio", "monto"])
    context = ""
    if not is_global:
        results = vector_db.search(req.question, n_results=5)
        context = "\n".join(results['documents'][0])
    history = "".join([f"{m['role']}: {m['content']}\n" for m in req.history[-3:]])
    full_prompt = (
        f"### ROL: Analista Senior LeaseLens AI.\n"
        f"### MEMORIA GLOBAL:\n{req.portfolio_summary}\n\n"
        f"### CONTEXTO PDF:\n{context}\n\n"
        f"### INSTRUCCIÓN: Responde en TEXTO PLANO.\n"
        f"### PREGUNTA: {req.question}"
    )
    async def generate():
        async for chunk in llm_chat.astream(full_prompt): yield chunk
    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}", status_code=204)
async def delete_vectors_from_ml(contract_id: str):
    vector_db.delete_documents(contract_id)
