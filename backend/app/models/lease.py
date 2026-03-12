import uuid
from datetime import datetime
from enum import Enum as PyEnum
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer,
    Numeric, String, Text, Enum, func, Float
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import Base


class LeaseStatus(PyEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Lease(Base):
    __tablename__ = "leases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String, nullable=False, unique=True)
    file_hash = Column(String(64), nullable=False, unique=True)
    minio_path = Column(String, nullable=False)
    status = Column(Enum(LeaseStatus), nullable=False, default=LeaseStatus.UPLOADED)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    progress = Column(Integer, nullable=False, default=0)

    # Parties
    arrendatario = Column(String, nullable=True)
    arrendador = Column(String, nullable=True)

    # Location
    sucursal = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    municipio = Column(String, nullable=True)
    direccion_completa = Column(Text, nullable=True)

    # Commercial terms
    superficie_m2 = Column(Numeric(10, 2), nullable=True)
    renta_mensual = Column(Numeric(12, 2), nullable=True)
    tipo_moneda = Column(String(10), nullable=True, default="MXN")
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_fin = Column(DateTime(timezone=True), nullable=True)
    penalizacion_rescision = Column(Text, nullable=True)

    # Content
    raw_text = Column(Text, nullable=True)
    resumen = Column(Text, nullable=True)

    # OCR Metrics
    ocr_data = Column(JSONB, nullable=True)
    ocr_confidence_avg = Column(Float, nullable=True)
    low_confidence_count = Column(Integer, nullable=True)
    total_words = Column(Integer, nullable=True)

    chunks = relationship("Chunk", back_populates="lease", cascade="all, delete-orphan")
    processing_time = Column(Float, nullable=True)


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lease_id = Column(UUID(as_uuid=True), ForeignKey("leases.id"), nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=True)

    lease = relationship("Lease", back_populates="chunks")
