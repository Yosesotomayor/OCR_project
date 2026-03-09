import os
import sys
import logging
from paddleocr import PaddleOCR

os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ModelDownloader")

def download_models():
    paddle_home = os.getenv('PADDLE_HOME', '/app/.paddleocr')
    logger.info(f"PADDLE_HOME: {paddle_home}")
    
    try:
        os.makedirs(paddle_home, exist_ok=True)
        
        logger.info("Intentando inicialización minimalista (lang='es')...")
        ocr = PaddleOCR(lang='es')
        
        logger.info("Modelos descargados exitosamente.")
        
    except Exception as e:
        logger.error(f"Error crítico en download_models: {e}")
        try:
            logger.info("Reintentando inicialización sin argumentos...")
            ocr = PaddleOCR()
            logger.info("Modelos base descargados.")
        except Exception as e2:
            logger.error(f"Fallo total: {e2}")
            sys.exit(1)

if __name__ == "__main__":
    download_models()
