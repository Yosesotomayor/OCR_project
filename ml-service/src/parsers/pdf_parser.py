import io
import numpy as np
import fitz  # PyMuPDF
from PIL import Image
from paddleocr import PaddleOCR
import logging

# Configurar logging para PaddleOCR (reducir ruido)
logging.getLogger("ppocr").setLevel(logging.ERROR)

# Inicializar PaddleOCR con esteroides para cifras y fechas
# det_db_unclip_ratio=2.0 ayuda a no cortar bordes de números (ej. el '1' o '$')
# rec_batch_num=16 optimiza la velocidad de inferencia en CPU/GPU
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
            
            # 1. Extracción nativa (preservando disposición para fechas/tablas)
            native_text = page.get_text("text", sort=True)
            
            # Si el texto nativo es muy pobre o no tiene dígitos (sospechoso), forzamos OCR
            has_digits = any(char.isdigit() for char in native_text)
            if native_text.strip() and len(native_text) > 150 and has_digits:
                full_text += f"--- PÁGINA {page_num + 1} ---\n{native_text}\n"
                continue
            
            # 2. OCR de Alta Fidelidad (300 DPI es el estándar de oro para documentos legales)
            pix = page.get_pixmap(dpi=300) 
            img_data = pix.samples
            img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
            img_np = np.array(img)
            
            # Ejecutar OCR con detección de ángulo
            result = ocr.ocr(img_np, cls=True)
            
            if result and result[0]:
                # Unimos líneas basándonos en la posición para mantener coherencia en cifras
                page_text = "\n".join([line[1][0] for line in result[0]])
                full_text += f"--- PÁGINA {page_num + 1} (OCR) ---\n{page_text}\n"
            else:
                full_text += f"--- PÁGINA {page_num + 1} (VACÍA) ---\n"

        return full_text
            
    except Exception as e:
        return f"ERROR CRÍTICO EN PARSER PADDLE: {str(e)}"
