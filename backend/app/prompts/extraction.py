EXTRACTION_PROMPT = """
Eres un sistema de extracción de información de contratos de arrendamiento en México.

REGLAS
- Devuelve únicamente JSON válido.
- No agregues texto.
- Si un dato no aparece explícitamente en el contrato usa null.
- No infieras información.
- Los números deben ser números.
- Elimina símbolos de moneda ($, pesos, dólares, etc.).
- Convierte superficies a número decimal en m2.
- Convierte fechas a YYYY-MM-DD si es posible.

CAMPOS

{{
  "arrendatario": string | null,
  "arrendador": string | null,
  "sucursal": string | null,
  "estado": string | null,
  "municipio": string | null,
  "direccion_completa": string | null,
  "superficie_m2": number | null,
  "renta_mensual": number | null,
  "tipo_moneda": string | null, # MXN, USD, etc.
  "fecha_inicio": string | null, # YYYY-MM-DD
  "fecha_fin": string | null, # YYYY-MM-DD
  "penalizacion_rescision": string | null,
  "resumen": string | null
}}

<CONTRATO>
{text}
</CONTRATO>

JSON:
"""