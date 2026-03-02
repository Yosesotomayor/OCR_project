from pypdf import PdfReader
import io
import easyocr # New import
from PIL import Image # New import for image processing
import numpy as np # New import for image processing
import fitz # PyMuPDF for converting PDF to image

# Initialize EasyOCR reader once
# This can be slow, so it's done at module level
# 'en' for English, 'es' for Spanish
reader = easyocr.Reader(['es', 'en'], gpu=True) # Assuming GPU is available in ML service

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extrae texto preservando la estructura visual para facilitar el Chunking Semántico.
    Usa OCR solo si el texto nativo es insuficiente.
    """
    full_text = ""
    try:
        # 1. Extracción Nativa con PyMuPDF (Mejor que pypdf para layout)
        doc = fitz.open(stream=file_content, filetype="pdf")

        for page in doc:
            # Obtener texto con estructura de bloques
            text = page.get_text("text") 
            if text.strip():
                full_text += f"--- PÁGINA {page.number + 1} ---\n{text}\n"

        # 2. Si el texto es muy pobre (< 50 caracteres por página), usar OCR
        if len(full_text) < 50 * len(doc):
            print("⚠️ Texto nativo insuficiente. Activando OCR de GPU...")
            full_text = "" # Reiniciar
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                pix = page.get_pixmap()
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                img_np = np.array(img)

                # EasyOCR con detalle para reconstruir líneas
                results = reader.readtext(img_np, detail=0, paragraph=True)
                page_text = "\n".join(results)
                full_text += f"--- PÁGINA {page_num + 1} (OCR) ---\n{page_text}\n"

        return full_text

    except Exception as e:
        return f"ERROR CRÍTICO EN PARSER: {str(e)}"