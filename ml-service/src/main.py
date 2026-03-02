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
# 1. Analista (Chat): Creativo y ameno
llm_chat = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=4096, temperature=0.7)

# 2. Extractor (Worker): Rápido y determinístico
llm_extractor = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=2048, temperature=0.0)

# 3. Validador (QA): Crítico y corrector
llm_validator = OllamaLLM(model="llama3.1:8b", base_url="http://ollama:11434", num_ctx=4096, temperature=0.1)

@app.on_event("startup")
async def warmup():
    try:
        llm_chat.invoke("Hi")
        logger.info("✅ Sistema Multi-Agente (Analista, Extractor, Validador) activo.")
    except: pass

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

class IngestRequest(BaseModel):
    contract_id: str
    s3_key: str
    filename: str

class ChatRequest(BaseModel):
    question: str
    history: Optional[List[dict]] = []
    portfolio_summary: Optional[str] = None

@app.get("/health")
async def health_check(): return {"status": "ok"}

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):
    logger.info(f"⚙️ Procesando: {contract_id}")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            check = await client.get(f"{BACKEND_URL}/contracts/{contract_id}/exists", headers={"X-Internal-Token": INTERNAL_TOKEN})
            if check.status_code != 200: return

            file_bytes = s3.download_file(s3_key)
            if not file_bytes: return

            text = extract_text_from_pdf(file_bytes)
            
            # Indexación para búsqueda futura
            chunks = splitter.split_text(text)
            vector_db.add_documents(chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            # PASO 1: EXTRACCIÓN (Agente Extractor)
            pages = text.split("--- PÁGINA")
            raw_data = {}
            target_fields = ["monto_renta", "moneda", "arrendatario", "fecha_vencimiento", "zona_propiedad"]
            
            for page_content in pages[:10]: # Escaneo de las primeras 10 páginas
                if not page_content.strip(): continue
                if len(raw_data) >= len(target_fields): break

                extract_prompt = (
                    f"### TAREA: Extrae JSON con: monto_renta, moneda, arrendatario, fecha_vencimiento, zona_propiedad.\n"
                    f"### TEXTO:\n{page_content[:3000]}\n\n"
                    f"### JSON:"
                )
                resp = llm_extractor.invoke(extract_prompt)
                try:
                    if "{" in resp:
                        data = json.loads(resp[resp.find("{"):resp.rfind("}")+1])
                        for k in target_fields:
                            if data.get(k) and not raw_data.get(k): raw_data[k] = data[k]
                except: continue

            # PASO 2: VALIDACIÓN (Agente Validador)
            logger.info(f"🔍 Validando datos para {contract_id}...")
            validation_prompt = (
                f"### SISTEMA: Eres un Auditor Legal de Mifel. Tu misión es corregir el JSON del Extractor.\n"
                f"### DATOS EXTRAÍDOS:\n{json.dumps(raw_data)}\n\n"
                f"### TEXTO DE REFERENCIA (Resumen):\n{text[:4000]}\n\n"
                f"### TAREA:\n"
                f"1. Verifica que 'monto_renta' sea la RENTA MENSUAL, no el depósito.\n"
                f"2. Asegura que el nombre del 'arrendatario' sea el correcto.\n"
                f"3. Si hay errores, corrígelos. Si falta algo y está en el texto, añádelo.\n"
                f"### RESPONDE ÚNICAMENTE CON EL JSON FINAL CORREGIDO:"
            )
            validated_resp = llm_validator.invoke(validation_prompt)
            
            final_json = raw_data
            try:
                if "{" in validated_resp:
                    final_json = json.loads(validated_resp[validated_resp.find("{"):validated_resp.rfind("}")+1])
            except: logger.warning("Fallo en parseo de validación, usando raw_data.")

            # Callback al Backend
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "extracted_data": json.dumps(final_json)},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            logger.info(f"✅ Proceso verificado finalizado: {contract_id}")

        except Exception as e:
            logger.error(f"💥 Error: {str(e)}")
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "error_detail": str(e)}, headers={"X-Internal-Token": INTERNAL_TOKEN})

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
        f"Analista Senior LeaseLens. Responde profesional en texto plano.\n"
        f"MEMORIA GLOBAL:\n{req.portfolio_summary}\n\n"
        f"CONTEXTO DOCUMENTAL:\n{context}\n\n"
        f"HISTORIAL:\n{history}\n"
        f"PREGUNTA: {req.question}\n"
        f"Dato clave: Prioriza la MEMORIA GLOBAL para estadísticas."
    )
    async def generate():
        async for chunk in llm_chat.astream(full_prompt): yield chunk
    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}", status_code=204)
async def delete_vectors_from_ml(contract_id: str):
    vector_db.delete_documents(contract_id)
