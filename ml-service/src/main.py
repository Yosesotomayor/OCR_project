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

# Configuración de logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LeaseLens ML Core v2.7")

s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

llm = OllamaLLM(model="llama3.2:3b", base_url=OLLAMA_URL, num_ctx=4096, temperature=0.0)

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
    """
    Envía actualizaciones al backend con sistema de reintentos.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        for i in range(3): # 3 Intentos
            try:
                r = await client.patch(
                    f"{BACKEND_URL}/contracts/{contract_id}", 
                    json=payload, 
                    headers={"X-Internal-Token": INTERNAL_TOKEN}
                )
                if r.status_code == 200: return True
            except Exception as e:
                logger.warning(f"Intento {i+1} fallido para {contract_id}: {e}")
                await asyncio.sleep(1)
    return False

async def run_heavy_processing(contract_id: str, s3_key: str):
    try:
        # 1. OCR (20%)
        await safe_patch(contract_id, {"status": "processing", "progress": 20})
        file_bytes = await asyncio.to_thread(s3.download_file, s3_key)
        text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
        
        # 2. Vectorización (40%)
        await safe_patch(contract_id, {"status": "processing", "progress": 40})
        chunks = splitter.split_text(text)
        await asyncio.to_thread(vector_db.add_documents, chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

        # 3. Extracción (80%)
        await safe_patch(contract_id, {"status": "processing", "progress": 80})
        
        # Reducimos el texto enviado a la IA para evitar que se cuelgue (primera 15k chars)
        context_text = text[:15000]
        prompt = (
            f"### TAREA: Extrae datos en JSON.\n"
            f"### CAMPOS: monto_renta (float), moneda, arrendatario, fecha_inicio (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), zona_propiedad.\n"
            f"### CONTRATO:\n{context_text}\n\n"
            f"### RESPUESTA (SOLO JSON):"
        )
        
        resp = await llm.ainvoke(prompt)
        
        final_data = {}
        try:
            clean = resp.strip()
            if "{" in clean:
                final_data = json.loads(clean[clean.find("{"):clean.rfind("}")+1])
        except: pass

        # 4. Finalizado (100%) - Forzado
        success = await safe_patch(contract_id, {
            "status": "completed", 
            "progress": 100, 
            "extracted_data": json.dumps(final_data)
        })
        if success: logger.info(f"✅ {contract_id} completado al 100%")
        
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
        f"Eres LeaseLens AI, el Socio Senior de Operaciones e Inteligencia Inmobiliaria. Tu objetivo es proporcionar análisis precisos, formales y ejecutivos.\n"
        f"PROTOCOLO DE COMUNICACIÓN:\n"
        f"1. **Formalidad:** Usa un lenguaje profesional y estructurado. Evita respuestas excesivamente breves o vagas.\n"
        f"2. **Small Talk:** Si el usuario saluda o interactúa socialmente, responde con cortesía de alto nivel (ej. 'Es un placer saludarle. Estoy listo para profundizar en el análisis de su portafolio. ¿Desea revisar algún contrato o métrica financiera hoy?').\n"
        f"3. **Uso de Contexto:** Cruza la información de la MEMORIA GLOBAL con el CONTEXTO ESPECÍFICO para dar respuestas 'inteligentes'.\n"
        f"4. **No Alucinar:** Si un dato no existe, indícalo con elegancia: 'Tras una revisión exhaustiva, ese detalle no consta en los registros actuales'.<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"### RESUMEN EJECUTIVO DEL PORTAFOLIO:\n{req.portfolio_summary}\n\n"
        f"### EVIDENCIA DOCUMENTAL ESPECÍFICA:\n{context}\n\n"
        f"### CONSULTA DEL USUARIO: {req.question}<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        async for chunk in llm.astream(full_prompt): yield chunk

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    await asyncio.to_thread(vector_db.delete_documents, contract_id)
    return {"status": "deleted"}
