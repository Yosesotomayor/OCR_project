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

# Configurar logging detallado
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML-Service")

s3 = S3Manager()
vector_db = VectorManager()

llm_ready = False

logger.info("🤖 Inicializando modelo Llama 3.1...")
llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url="http://ollama:11434",
    num_ctx=2048,
    stop=["<|eot_id|>"]
)
llm_ready = True

@app.on_event("startup")
async def warmup_llm():
    try:
        logger.info("🔥 Pre-calentando LLM en VRAM...")
        llm.invoke("Responde 'ready'")
        logger.info("✅ LLM listo y caliente.")
    except Exception as e:
        logger.error(f"❌ Error en warmup: {e}")

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
async def health_check():
    return {"status": "ok", "llm_ready": llm_ready}

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):
    logger.info(f"⚙️ Iniciando procesamiento pesado para {contract_id} ({filename})")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # 1. Validar existencia en backend
            logger.info(f"🔍 Validando existencia en backend...")
            check = await client.get(
                f"{BACKEND_URL}/contracts/{contract_id}/exists",
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            if check.status_code != 200:
                logger.error(f"❌ Abortando: Backend respondio {check.status_code}")
                return

            # 2. Descargar de S3
            logger.info(f"📥 Descargando archivo de S3: {s3_key}")
            file_bytes = s3.download_file(s3_key)
            if not file_bytes:
                logger.error("❌ Fallo descarga de S3")
                await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "error_detail": "S3 download failed"}, headers={"X-Internal-Token": INTERNAL_TOKEN})
                return

            # 3. OCR / Extracción
            logger.info("📄 Extrayendo texto (OCR si es necesario)...")
            text = extract_text_from_pdf(file_bytes)
            if text.startswith("ERROR:"):
                logger.error(f"❌ Error OCR: {text}")
                await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "error_detail": text}, headers={"X-Internal-Token": INTERNAL_TOKEN})
                return
            
            # 4. Vectorización
            logger.info(f"🧠 Vectorizando {len(text)} caracteres...")
            chunks = splitter.split_text(text)
            metadatas = [{"doc_id": contract_id, "filename": filename} for _ in chunks]
            ids = [f"{contract_id}_{i}" for i in range(len(chunks))]
            vector_db.add_documents(chunks, metadatas, ids)

            # 5. Extracción Estructurada con LLM (Ultra-Strict & Numeric Cleaning)
            logger.info("🧠 Invocando LLM para extracción de campos...")
            prompt = (
                f"### SISTEMA: Eres un extractor de datos profesional.\n"
                f"### REGLA: RESPONDE ÚNICAMENTE CON JSON. SIN EXPLICACIONES.\n"
                f"### INSTRUCCIONES DE CAMPOS:\n"
                f"- 'monto_renta': DEBE SER UN NÚMERO PURO (ej: 29703.76). Quita '$' y ','.\n"
                f"- 'moneda': Código ISO (ej: MXN, USD).\n"
                f"- 'arrendatario': Nombre de la persona o empresa.\n"
                f"- 'fecha_vencimiento': Formato YYYY-MM-DD o null.\n"
                f"- 'nombre_propiedad' y 'zona_propiedad': Strings cortos.\n\n"
                f"### TEXTO DEL CONTRATO:\n{text[:4000]}"
            )
            raw_extraction = llm.invoke(prompt)

            # Limpieza profunda del JSON
            clean_json = raw_extraction.strip()
            if "{" in clean_json and "}" in clean_json:
                clean_json = clean_json[clean_json.find("{"):clean_json.rfind("}")+1]

            logger.info(f"✨ JSON extraído: {clean_json}")


            # 6. Notificar al backend
            logger.info(f"Finalizado. Notificando éxito al backend...")
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "extracted_data": clean_json},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )

        except Exception as e:
            logger.error(f"Error en run_heavy_processing: {str(e)}")
            try:
                await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "error_detail": str(e)}, headers={"X-Internal-Token": INTERNAL_TOKEN})
            except: pass

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    logger.info(f"📬 Recibida solicitud de proceso para ID: {req.contract_id}")
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key, req.filename)
    return {"message": "Queued", "id": req.contract_id}

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    logger.info(f"💬 Consulta recibida: {req.question[:50]}...")
    results = vector_db.search(req.question, n_results=5)
    context = "\n".join(results['documents'][0])

    formatted_history = ""
    for msg in req.history[-3:]:
        role = "Usuario" if msg['role'] == 'user' else "Asistente"
        formatted_history += f"{role}: {msg['content']}\n"

    full_prompt = (
        f"Eres un analista legal experto de LeaseLens AI.\n"
        f"RESUMEN GLOBAL DEL PORTAFOLIO:\n{req.portfolio_summary}\n\n"
        f"Historial:\n{formatted_history}\n"
        f"CONTEXTO DE CLÁUSULAS:\n{context}\n\n"
        f"Responde de forma profesional.\nPregunta: {req.question}"
    )

    async def generate():
        async for chunk in llm.astream(full_prompt):
            yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vectors_from_ml(contract_id: str):
    logger.info(f"🗑️ Borrando vectores para {contract_id}")
    vector_db.delete_documents(contract_id)
