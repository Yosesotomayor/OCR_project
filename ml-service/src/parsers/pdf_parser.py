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
    """Extrae texto de un PDF en memoria, usando OCR si es necesario."""
    full_text = ""
    try:
        # 1. Intentar extracción de texto nativa con pypdf
        reader_pypdf = PdfReader(io.BytesIO(file_content))
        for page in reader_pypdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        if full_text.strip():
            return full_text # Si se encontró texto, devolverlo
        
        # 2. Si no se encontró texto, intentar OCR con EasyOCR
        # Usar PyMuPDF para convertir páginas de PDF a imágenes
        doc = fitz.open(stream=file_content, filetype="pdf")
        ocr_text = ""
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            pix = page.get_pixmap()
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            # Convert PIL Image to numpy array for EasyOCR
            img_np = np.array(img)
            
            results = reader.readtext(img_np, detail=0) # detail=0 returns only text
            ocr_text += " ".join(results) + "\n"
        
        if ocr_text.strip():
            return ocr_text
        else:
            return "ERROR: No se pudo extraer texto del PDF (ni nativo ni con OCR)."
            
    except Exception as e:
        return f"Error procesando PDF (con OCR): {str(e)}"