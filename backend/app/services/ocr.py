import fitz
from PIL import Image
import cv2
import numpy as np
from app.infrastructure.ml import OCREngine
from app.core.config import settings

class OCRService:
    def __init__(self, ocr_engine: OCREngine):
        self.ocr_engine = ocr_engine
        self.dpi = settings.ocr_dpi
        self.low_conf_threshold = settings.low_conf_threshold

    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        _, thresholded = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return Image.fromarray(thresholded)

    def _convert_pdf_to_images(self, pdf_bytes: bytes) -> list[Image.Image]:
        zoom = self.dpi / 72  
        matrix = fitz.Matrix(zoom, zoom)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            images.append(img)
        return images

    def extract_text(self, pdf_bytes: bytes) -> dict:
        images = self._convert_pdf_to_images(pdf_bytes)
        full_text_pages = []
        all_words_data = []
        
        total_conf = 0
        word_count = 0
        low_conf_count = 0

        for page_idx, image in enumerate(images):
            preprocessed = self._preprocess_image(image)
            data = self.ocr_engine.extract_text(preprocessed)
            
            page_text = ""
            last_line_num = -1
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                text = data['text'][i].strip()
                if not text:
                    continue
                
                conf = float(data['conf'][i])
                if conf == -1: # Tesseract uses -1 for non-text blocks
                    continue
                
                line_num = data['line_num'][i]
                
                # Reconstruct text with line breaks within page
                if last_line_num != -1 and line_num != last_line_num:
                    page_text += "\n"
                elif page_text:
                    page_text += " "
                
                page_text += text
                last_line_num = line_num
                
                # Collect word metadata
                word_info = {
                    "text": text,
                    "conf": conf,
                    "page": page_idx + 1,
                    "line": line_num,
                    "bbox": [
                        data['left'][i], 
                        data['top'][i], 
                        data['width'][i], 
                        data['height'][i]
                    ]
                }
                all_words_data.append(word_info)
                
                # Aggregate metrics
                total_conf += conf
                word_count += 1
                if conf < self.low_conf_threshold:
                    low_conf_count += 1
            
            full_text_pages.append(page_text)
            
        avg_conf = (total_conf / word_count) if word_count > 0 else 0
        
        return {
            "raw_text": "\n\n".join(full_text_pages),
            "ocr_data": all_words_data,
            "metrics": {
                "avg_conf": avg_conf,
                "low_conf_count": low_conf_count,
                "total_words": word_count
            }
        }
