from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class LeaseStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class LeaseBase(BaseModel):
    filename: str
    arrendatario: Optional[str] = None
    arrendador: Optional[str] = None
    sucursal: Optional[str] = None
    estado: Optional[str] = None
    municipio: Optional[str] = None
    direccion_completa: Optional[str] = None
    superficie_m2: Optional[Decimal] = None
    renta_mensual: Optional[Decimal] = None
    tipo_moneda: Optional[str] = "MXN"
    fecha_inicio: Optional[datetime] = None
    fecha_fin: Optional[datetime] = None
    penalizacion_rescision: Optional[str] = None
    resumen: Optional[str] = None
    processing_time: Optional[float] = None
    ocr_confidence_avg: Optional[float] = None
    low_confidence_count: Optional[int] = None
    total_words: Optional[int] = None


class LeaseOut(LeaseBase):
    id: UUID
    status: LeaseStatus
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeaseList(BaseModel):
    total: int
    items: list[LeaseOut]


class LeaseProgressOut(BaseModel):
    status: LeaseStatus
    progress: int