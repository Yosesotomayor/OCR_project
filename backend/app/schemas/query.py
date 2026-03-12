from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class QueryFilters(BaseModel):
    arrendatario: Optional[str] = None
    arrendador: Optional[str] = None
    sucursal: Optional[str] = None
    estado: Optional[str] = None
    municipio: Optional[str] = None
    min_superficie_m2: Optional[float] = None
    max_superficie_m2: Optional[float] = None
    min_renta_mensual: Optional[float] = None
    max_renta_mensual: Optional[float] = None
    tipo_moneda: Optional[str] = None
    starts_before: Optional[datetime] = None
    starts_after: Optional[datetime] = None
    expires_before: Optional[datetime] = None
    expires_after: Optional[datetime] = None


class QueryIntent(BaseModel):
    filters: QueryFilters
    search_query: str


class ChunkSource(BaseModel):
    chunk_id: str
    lease_id: str
    lease_filename: str
    sucursal: Optional[str]
    text: str

    model_config = ConfigDict(from_attributes=True)


from app.schemas.chat import SendMessageRequest

class SearchRequest(SendMessageRequest):
    pass


class SearchResponse(BaseModel):
    answer: str
    sources: list[ChunkSource]
