import io
import numpy as np
import fitz 
from PIL import Image
from paddleocr import PaddleOCR
import logging

logging.getLogger("ppocr").setLevel(logging.ERROR)


ocr = PaddleOCR(
    use_angle_cls=True, 
    lang="es", 
    det_db_unclip_ratio=2.0,
    rec_batch_num=16
)

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrae texto de un PDF usando un flujo híbrido optimizado.
    """
    full_text = ""
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            
            native_text = page.get_text("text", sort=True)
            
            has_digits = any(char.isdigit() for char in native_text)
            if native_text.strip() and len(native_text) > 150 and has_digits:
                full_text += f"--- PÁGINA {page_num + 1} ---\n{native_text}\n"
                continue
            
            pix = page.get_pixmap(dpi=300) 
            img_data = pix.samples
            img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
            img_np = np.array(img)
            
            result = ocr.ocr(img_np, cls=True)
            
            if result and result[0]:
                page_text = "\n".join([line[1][0] for line in result[0]])
                full_text += f"--- PÁGINA {page_num + 1} (OCR) ---\n{page_text}\n"
            else:
                full_text += f"--- PÁGINA {page_num + 1} (VACÍA) ---\n"

        return full_text
            
    except Exception as e:
        return f"ERROR CRÍTICO EN PARSER PADDLE: {str(e)}"
