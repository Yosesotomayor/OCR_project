import easyocr
print("Descargando modelos de EasyOCR...")
reader = easyocr.Reader(['es', 'en'], gpu=False)
print("Modelos descargados con éxito.")