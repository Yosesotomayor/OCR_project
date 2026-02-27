from pypdf import PdfReader
import io

def extract_text_from_pdf(file_content: bytes) -> str:
    """Extrae texto de un PDF en memoria."""
    try:
        # Cargamos el archivo desde los bytes de MinIO/Upload
        reader = PdfReader(io.BytesIO(file_content))
        full_text = ""
        
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        if not full_text.strip():
            # Si el PDF es una imagen (escaneado), aquí es donde entraría EasyOCR
            return "ERROR: El PDF parece ser una imagen o está vacío."
            
        return full_text
    except Exception as e:
        return f"Error procesando PDF: {str(e)}"