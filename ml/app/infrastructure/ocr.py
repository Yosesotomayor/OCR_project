import pytesseract
from PIL import Image
from typing import Any
from app.core.config import settings

class OCREngine:
    def __init__(self):
        self.lang = settings.tesseract_lang
        self.config = settings.tesseract_config

    def extract_text(self, image: Image.Image) -> dict[str, Any]:
        return pytesseract.image_to_data(
            image,
            lang=self.lang,
            config=self.config,
            output_type=pytesseract.Output.DICT
        )
