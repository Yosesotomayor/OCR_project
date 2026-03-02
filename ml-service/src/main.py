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

# Inicialización diferida
s3 = S3Manager()
vector_db = VectorManager()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "super-secret-key-123")
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")

# --- MODELOS ---
# Usamos Llama 3.2 3B para TODO (Chat y Extracción) por su velocidad extrema
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
async def health():
    return {"status": "ok", "engine": "Llama 3.2 (3B) Full-Speed"}

@app.post("/process")
async def process(req: IngestRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_heavy_processing, req.contract_id, req.s3_key)
    return {"message": "Queued"}

async def run_heavy_processing(contract_id: str, s3_key: str):
    async with httpx.AsyncClient(timeout=300.0) as client:
        try:
            # 1. Fase OCR (20%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "processing", "progress": 20}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
            file_bytes = s3.download_file(s3_key)
            text = extract_text_from_pdf(file_bytes)
            
            # 2. Fase Vectorización (40%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "processing", "progress": 40}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
            chunks = splitter.split_text(text)
            vector_db.add_documents(chunks, [{"doc_id": contract_id} for _ in chunks], [f"{contract_id}_{i}" for i in range(len(chunks))])

            # 3. Fase Extracción IA (80%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "processing", "progress": 80}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
            
            # Tomamos la primera parte del contrato (donde suelen estar los datos clave)
            first_pages = text[:6000] 
            extract_prompt = (
                f"### TAREA: Extrae datos del contrato en JSON.\n"
                f"### CAMPOS: monto_renta (float), moneda, arrendatario, fecha_inicio (YYYY-MM-DD), fecha_vencimiento (YYYY-MM-DD), zona_propiedad, nombre_propiedad.\n"
                f"### TEXTO:\n{first_pages}\n\n"
                f"### RESPUESTA (SOLO JSON):"
            )
            resp = llm.invoke(extract_prompt)
            
            final_data = {}
            try:
                clean = resp.strip()
                if "{" in clean:
                    final_data = json.loads(clean[clean.find("{"):clean.rfind("}")+1])
            except:
                logger.warning(f"No se pudo parsear JSON de extracción para {contract_id}")

            # 4. Finalizado (100%)
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={
                                 "status": "completed", 
                                 "progress": 100,
                                 "extracted_data": json.dumps(final_data)
                             }, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})
            
        except Exception as e:
            logger.error(f"Error crítico en proceso pesado: {e}")
            await client.patch(f"{BACKEND_URL}/contracts/{contract_id}", 
                             json={"status": "error", "progress": 0, "error_detail": str(e)}, 
                             headers={"X-Internal-Token": INTERNAL_TOKEN})

@app.post("/query-stream")
async def query_stream(req: ChatRequest):
    q = req.question.lower()
    is_trivial = any(w in q for w in ["hola", "buenos dias", "quien eres", "gracias", "bye", "saludos", "ayuda"])
    is_global = any(w in q for w in ["cuantos", "total", "resumen", "lista", "portafolio", "monto"])
    
    context = ""
    if not is_trivial and not is_global:
        try:
            results = vector_db.search(req.question, n_results=3)
            context = "\n".join(results['documents'][0])
        except: pass
    
    full_prompt = (
        f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n"
        f"Eres LeaseLens AI, un Analista Senior especializado EXCLUSIVAMENTE en gestión de arrendamientos y activos inmobiliarios.\n"
        f"REGLAS DE IDENTIDAD:\n"
        f"1. No eres un asistente general. No ayudas con matemáticas, programación, ni creación de contenido ajeno al sector legal/inmobiliario.\n"
        f"2. Si te preguntan cómo puedes ayudar, responde que tu especialidad es: 'Analizar contratos de arrendamiento, extraer montos de renta, vigilar fechas de vencimiento y optimizar el cumplimiento de tu portafolio'.\n"
        f"3. Tu tono es ejecutivo, sobrio y altamente profesional.\n"
        f"4. Usa el PORTAFOLIO proporcionado para responder con datos reales.<|eot_id|>\n"
        f"<|start_header_id|>user<|end_header_id|>\n\n"
        f"### PORTAFOLIO ACTUAL:\n{req.portfolio_summary}\n\n"
        f"### CONTEXTO DE DOCUMENTO:\n{context}\n\n"
        f"### PREGUNTA: {req.question}<|eot_id|>\n"
        f"<|start_header_id|>assistant<|end_header_id|>\n\n"
    )
    
    async def generate():
        try:
            async for chunk in llm.astream(full_prompt):
                yield chunk
        except Exception as e:
            yield f"Error IA: {str(e)}"

    return StreamingResponse(generate(), media_type="text/plain")

@app.delete("/delete-vectors/{contract_id}")
async def delete_vectors(contract_id: str):
    vector_db.delete_documents(contract_id)
    return {"status": "deleted"}
