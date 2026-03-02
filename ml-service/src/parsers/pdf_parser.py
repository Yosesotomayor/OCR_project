import io
import numpy as np
import fitz  # PyMuPDF
from PIL import Image
from paddleocr import PaddleOCR
import logging

# Configurar logging para PaddleOCR (reducir ruido)
logging.getLogger("ppocr").setLevel(logging.ERROR)

# Inicializar PaddleOCR (Español e Inglés)
# use_angle_cls=True ayuda a detectar texto rotado
# lang="es" para optimizar detección en español
ocr = PaddleOCR(use_angle_cls=True, lang="es")

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrae texto de un PDF usando PaddleOCR para máxima precisión.
    Preserva el flujo de lectura del documento.
    """
    full_text = ""
    try:
        # Abrir documento con PyMuPDF
        doc = fitz.open(stream=file_content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            
            # 1. Intentar extracción nativa primero (rápida)
            native_text = page.get_text("text")
            
            # Si la página tiene texto real suficiente, lo usamos
            if native_text.strip() and len(native_text) > 100:
                full_text += f"--- PÁGINA {page_num + 1} ---\n{native_text}\n"
                continue
            
            # 2. Si no hay texto nativo (escaneado), usamos PaddleOCR
            # Renderizar página a imagen de alta resolución para OCR (300 DPI)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) 
            img_data = pix.samples
            img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
            img_np = np.array(img)
            
            # Ejecutar PaddleOCR
            result = ocr.ocr(img_np, cls=True)
            
            if result and result[0]:
                # PaddleOCR devuelve [box, (text, confidence)]
                page_text = "\n".join([line[1][0] for line in result[0]])
                full_text += f"--- PÁGINA {page_num + 1} (OCR) ---\n{page_text}\n"
            else:
                full_text += f"--- PÁGINA {page_num + 1} (VACÍA) ---\n"

        return full_text
            
    except Exception as e:
        return f"ERROR CRÍTICO EN PARSER PADDLE: {str(e)}"
