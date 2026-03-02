import os
import sys
import logging
from paddleocr import PaddleOCR

# Silenciar warnings de conexiones y optimizar
os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ModelDownloader")

def download_models():
    """
    Inicialización ultra-robusta para pre-descarga de modelos.
    Si fallan los argumentos nombrados, intenta con el mínimo posible.
    """
    paddle_home = os.getenv('PADDLE_HOME', '/app/.paddleocr')
    logger.info(f"PADDLE_HOME: {paddle_home}")
    
    try:
        os.makedirs(paddle_home, exist_ok=True)
        
        logger.info("Intentando inicialización minimalista (lang='es')...")
        # Intentamos solo con 'lang', que es el argumento más esencial.
        # PaddleOCR descargará los modelos de detección, reconocimiento y clasificación por defecto.
        ocr = PaddleOCR(lang='es')
        
        logger.info("Modelos descargados exitosamente.")
        
    except Exception as e:
        logger.error(f"Error crítico en download_models: {e}")
        # Si incluso esto falla, intentamos sin ningún argumento
        try:
            logger.info("Reintentando inicialización sin argumentos...")
            ocr = PaddleOCR()
            logger.info("Modelos base descargados.")
        except Exception as e2:
            logger.error(f"Fallo total: {e2}")
            sys.exit(1)

if __name__ == "__main__":
    download_models()
