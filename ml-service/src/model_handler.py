import easyocr
import time
from shared_schemas.schemas import OCRResult

class EasyOCRModel:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = easyocr.Reader(['es', 'en'], gpu=False) 
        return cls._instance

    @classmethod
    def predict(cls, file_path: str):
        reader = cls()
        start_time = time.time()
        
        # Inferencia
        results = reader.readtext(file_path)
        
        processed_results = [
            OCRResult(
                text=res[1], 
                confidence=float(res[2]), 
                processing_time_ms=(time.time() - start_time) * 1000
            ) for res in results
        ]
        return processed_results