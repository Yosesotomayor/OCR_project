import io
import numpy as np
import fitz 
from PIL import Image
from paddleocr import PaddleOCR
import logging

# Desactivar logs innecesarios para mayor velocidad
logging.getLogger("ppocr").setLevel(logging.ERROR)

# Inicializar PaddleOCR con parámetros para tablas y español
ocr = PaddleOCR(
    use_angle_cls=True, 
    lang="es", 
    det_db_unclip_ratio=2.0,
    rec_batch_num=16,
    show_log=False
)

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrae texto de un PDF forzando OCR visual para preservar la estructura de tablas,
    independientemente de si es un PDF nativo o escaneado.
    """
    full_text = ""
    try:
        # Abrimos el PDF con PyMuPDF (fitz)
        doc = fitz.open(stream=file_content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            
            # Convertimos la página a imagen (DPI alto para capturar bordes de tablas)
            pix = page.get_pixmap(dpi=300) 
            img_data = pix.samples
            img = Image.frombytes("RGB", [pix.width, pix.height], img_data)
            img_np = np.array(img)
            
            # Ejecutamos OCR visual
            result = ocr.ocr(img_np, cls=True)
            
            if result and result[0]:
                # Ordenamos las cajas detectadas por posición vertical (y) y luego horizontal (x)
                # Esto ayuda a que el LLM entienda las filas de las tablas
                lines = result[0]
                lines.sort(key=lambda x: (x[0][0][1], x[0][0][0])) 
                
                page_text = "\n".join([line[1][0] for line in lines])
                full_text += f"--- PÁGINA {page_num + 1} (VISION) ---\n{page_text}\n"
            else:
                # Si el OCR falla, intentamos extracción de texto nativo como respaldo
                native_text = page.get_text("text", sort=True)
                full_text += f"--- PÁGINA {page_num + 1} (NATIVO) ---\n{native_text}\n"

        return full_text
            
    except Exception as e:
        logging.error(f"Error en extracción PDF: {e}")
        return f"ERROR CRÍTICO EN PARSER PADDLE: {str(e)}"
