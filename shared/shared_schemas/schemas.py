from pydantic import BaseModel, Field
from typing import List, Optional

class OCRRequest(BaseModel):
    file_path: str = Field(..., description="Ruta al archivo en el storage compartido")
    language: str = "spa"

class OCRResult(BaseModel):
    text: str
    confidence: float = Field(..., ge=0, le=1)
    processing_time_ms: float

class OCRResponse(BaseModel):
    status: str = "success"
    results: List[OCRResult]
    error: Optional[str] = None