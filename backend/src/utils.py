import re
import json
import logging
from decimal import Decimal

def extract_json_from_text(text: str) -> dict:
    """Extrae y parsea el primer bloque JSON encontrado en un string."""
    try:
        match = re.search(r"(\{.*?\})", text, re.DOTALL)
        if match:
            json_str = match.group(1)
            return json.loads(json_str)
        return {}
    except (json.JSONDecodeError, AttributeError) as e:
        logging.error(f"Error parseando JSON del LLM: {e}")
        return {}

def safe_decimal(value) -> Decimal:
    """Limpia strings de moneda (ej: '$15,000.00') y convierte a Decimal."""
    if value is None: return Decimal("0.00")
    if isinstance(value, (int, float)): return Decimal(str(value))
    
    clean_val = re.sub(r'[^\d.]', '', str(value))
    try:
        return Decimal(clean_val) if clean_val else Decimal("0.00")
    except:
        return Decimal("0.00")