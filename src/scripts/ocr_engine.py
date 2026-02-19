import cv2
import pytesseract
import numpy as np
import os
from PIL import Image

class OCREngine:
    def __init__(self, tesseract_cmd: str = None):
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        self.config = r"--oem 3 --psm 6"

    def _preprocess_image(self, image_path: str) -> np.ndarray:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"No encuentro la imagen: {image_path}")
        img = cv2.imread(image_path)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        return thresh

    def extract_text(self, image_path: str) -> str:
        try:
            processed_img = self._preprocess_image(image_path)
            text = pytesseract.image_to_string(processed_img, config=self.config)
            return text.strip()

        except Exception as e:
            print(f"Error procesando {image_path}: {e}")
            return ""


if __name__ == "__main__":
    ocr = OCREngine()
    print(ocr.extract_text("data/Image.jpeg"))
