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

llm = OllamaLLM(
    model="llama3.1:8b", 
    base_url="http://ollama:11434",
    num_ctx=4096, # Aumentado para mejor contexto
    stop=["<|eot_id|>"]
)

@app.on_event("startup")
async def warmup_llm():
    try:
        logger.info("🔥 Warmup LLM...")
        llm.invoke("Hi")
        logger.info("✅ LLM Ready.")
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
async def health_check():
    return {"status": "ok"}

async def run_heavy_processing(contract_id: str, s3_key: str, filename: str):
    logger.info(f"⚙️ Procesando: {contract_id}")
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # 1. Check existence
            check = await client.get(f"{BACKEND_URL}/contracts/{contract_id}/exists", headers={"X-Internal-Token": INTERNAL_TOKEN})
            if check.status_code != 200: return

            # 2. S3 Download
            file_bytes = s3.download_file(s3_key)
            if not file_bytes: return

            # 3. Smart OCR
            text = extract_text_from_pdf(file_bytes)
            
            # 4. Vectorize
            chunks = splitter.split_text(text)
            vector_db.add_documents(chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            # 5. ESTRATEGIA DE EXTRACCIÓN ROBUSTA
            pages = text.split("--- PÁGINA")
            extracted_data = {}
            target_fields = ["monto_renta", "moneda", "arrendatario", "fecha_vencimiento", "zona_propiedad"]
            
            for i, page_content in enumerate(pages):
                if not page_content.strip(): continue
                if len(extracted_data) >= len(target_fields): break # Optimización

                prompt = (
                    f"### TAREA: Extrae datos del contrato en este fragmento.\n"
                    f"### REGLA: RESPONDE SOLO CON JSON. Usa estas llaves exactas:\n"
                    f"- monto_renta (número puro, ej: 15000.50)\n"
                    f"- moneda (ISO ej: MXN)\n"
                    f"- arrendatario (nombre)\n"
                    f"- fecha_vencimiento (YYYY-MM-DD)\n"
                    f"- zona_propiedad (string)\n\n"
                    f"### FRAGMENTO:\n{page_content[:3000]}\n\n"
                    f"### RESPUESTA (JSON):"
                )
                
                resp = llm.invoke(prompt)
                try:
                    clean = resp.strip()
                    if "{" in clean and "}" in clean:
                        data = json.loads(clean[clean.find("{"):clean.rfind("}")+1])
                        for k in target_fields:
                            if data.get(k) and not extracted_data.get(k):
                                extracted_data[k] = data[k]
                except: continue

            # 6. Callback al Backend
            await client.patch(
                f"{BACKEND_URL}/contracts/{contract_id}",
                json={"status": "completed", "extracted_data": json.dumps(extracted_data)},
                headers={"X-Internal-Token": INTERNAL_TOKEN}
            )
            logger.info(f"✅ Finalizado: {contract_id}")

        except Exception as e:
            logger.error(f"💥 Error: {str(e)}")
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", json={"status": "error", "error_detail": str(e)}, headers={"X-Internal-Token": INTERNAL_TOKEN})

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key, req.filename)
    return {"message": "Queued"}

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    results = vector_db.search(req.question, n_results=5)
    context = "\n".join(results['documents'][0])
    history = "".join([f"{m['role']}: {m['content']}\n" for m in req.history[-3:]])

    full_prompt = (
        f"Analista Legal. Responde profesional en texto plano (sin markdown).\n"
        f"PORTAFOLIO:\n{req.portfolio_summary}\n\n"
        f"CONTEXTO:\n{context}\n\n"
        f"HISTORIAL:\n{history}\n"
        f"PREGUNTA: {req.question}"
    )

    async def generate():
        async for chunk in llm.astream(full_prompt): yield chunk
    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}", status_code=204)
async def delete_vectors_from_ml(contract_id: str):
    vector_db.delete_documents(contract_id)
