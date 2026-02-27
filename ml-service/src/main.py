from fastapi import FastAPI, HTTPException
from shared_schemas.schemas import OCRRequest, OCRResponse
from model_handler import EasyOCRModel
import os

app = FastAPI(title="ML Service - EasyOCR")

model = EasyOCRModel()

@app.post("/predict", response_model=OCRResponse)
async def predict(request: OCRRequest):
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en storage")

    try:
        results = model.predict(request.file_path)
        return OCRResponse(results=results)
    except Exception as e:
        return OCRResponse(status="error", results=[], error=str(e))