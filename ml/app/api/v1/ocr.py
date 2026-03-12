import io
from fastapi import APIRouter, Depends, UploadFile, File
from PIL import Image
from typing import Any
from app.api.deps import get_ocr_engine
from app.infrastructure.ocr import OCREngine

router = APIRouter(prefix="/ocr", tags=["ocr"])

@router.post("/extract", response_model=dict[str, Any])
def extract(
    file: UploadFile = File(...),
    ocr: OCREngine = Depends(get_ocr_engine)
):
    contents = file.file.read()
    image = Image.open(io.BytesIO(contents))
    return ocr.extract_text(image)