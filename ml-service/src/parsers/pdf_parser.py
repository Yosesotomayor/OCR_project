import io
import os
import numpy as np
import fitz 
from PIL import Image
import logging

# DESACTIVACIÓN CRÍTICA ANTES DE IMPORTAR PADDLE
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['OMP_NUM_THREADS'] = '1'

from paddleocr import PaddleOCR
logging.getLogger("ppocr").setLevel(logging.ERROR)

# Inicialización mínima segura
try:
    ocr = PaddleOCR(lang="es", use_gpu=False, show_log=False)
except:
    ocr = None

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrae texto de un PDF reconstruyendo tablas visualmente para que el LLM
    pueda distinguir columnas de fechas y montos.
    """
    full_text = ""
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            
            ocr_success = False
            if ocr:
                try:
                    # Usamos 300 DPI para capturar bordes de tablas con precisión
                    pix = page.get_pixmap(dpi=300) 
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    img_np = np.array(img)
                    result = ocr.ocr(img_np)
                    
                    if result and result[0]:
                        raw_lines = result[0]
                        # ORDENAMIENTO ESPACIAL: Agrupar por filas (tolerancia 10px)
                        rows = []
                        raw_lines.sort(key=lambda x: x[0][0][1]) # Ordenar por Y
                        
                        if raw_lines:
                            current_row = [raw_lines[0]]
                            for i in range(1, len(raw_lines)):
                                # Si la diferencia de altura es menor a 10px, están en la misma fila
                                if abs(raw_lines[i][0][0][1] - current_row[-1][0][0][1]) < 10:
                                    current_row.append(raw_lines[i])
                                else:
                                    current_row.sort(key=lambda x: x[0][0][0]) # Ordenar fila por X
                                    rows.append(current_row)
                                    current_row = [raw_lines[i]]
                            current_row.sort(key=lambda x: x[0][0][0])
                            rows.append(current_row)

                        # Formatear como Tabla Markdown para el LLM
                        page_text_lines = []
                        for row in rows:
                            if len(row) > 1:
                                row_str = "| " + " | ".join([l[1][0] for l in row]) + " |"
                                page_text_lines.append(row_str)
                            else:
                                page_text_lines.append(row[0][1][0])
                        
                        page_text = "\n".join(page_text_lines)
                        full_text += f"\n=== INICIO PÁGINA {page_num + 1} (VISION) ===\n{page_text}\n=== FIN PÁGINA {page_num + 1} ===\n"
                        ocr_success = True
                except Exception as e:
                    logging.error(f"Error OCR en p{page_num+1}: {e}")

            if not ocr_success:
                # Respaldo Nativo si el OCR visual falla
                native_text = page.get_text("text", sort=True).strip()
                full_text += f"\n=== INICIO PÁGINA {page_num + 1} (NATIVO) ===\n{native_text}\n=== FIN PÁGINA {page_num + 1} ===\n"

        return full_text
            
    except Exception as e:
        logging.error(f"Error crítico en parser: {e}")
        return f"ERROR PARSER: {str(e)}"
