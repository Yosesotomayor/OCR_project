from typing import Sequence, Optional
from uuid import UUID
from sqlalchemy import select
from app.models.lease import Chunk, Lease
from app.repositories.base import BaseRepo
from app.schemas.query import QueryFilters

class ChunkRepo(BaseRepo[Chunk]):
    def __init__(self, db):
        super().__init__(Chunk, db)

    def _apply_filters(self, stmt, filters: QueryFilters):
        if filters.arrendatario:
            stmt = stmt.where(Lease.arrendatario.ilike(f"%{filters.arrendatario}%"))
        if filters.arrendador:
            stmt = stmt.where(Lease.arrendador.ilike(f"%{filters.arrendador}%"))
        if filters.sucursal:
            stmt = stmt.where(Lease.sucursal.ilike(f"%{filters.sucursal}%"))
        if filters.estado:
            stmt = stmt.where(Lease.estado.ilike(f"%{filters.estado}%"))
        if filters.municipio:
            stmt = stmt.where(Lease.municipio.ilike(f"%{filters.municipio}%"))
        if filters.min_superficie_m2 is not None:
            stmt = stmt.where(Lease.superficie_m2 >= filters.min_superficie_m2)
        if filters.max_superficie_m2 is not None:
            stmt = stmt.where(Lease.superficie_m2 <= filters.max_superficie_m2)
        if filters.min_renta_mensual is not None:
            stmt = stmt.where(Lease.renta_mensual >= filters.min_renta_mensual)
        if filters.max_renta_mensual is not None:
            stmt = stmt.where(Lease.renta_mensual <= filters.max_renta_mensual)
        if filters.tipo_moneda:
            stmt = stmt.where(Lease.tipo_moneda == filters.tipo_moneda)
        if filters.starts_before:
            stmt = stmt.where(Lease.fecha_inicio <= filters.starts_before)
        if filters.starts_after:
            stmt = stmt.where(Lease.fecha_inicio >= filters.starts_after)
        if filters.expires_before:
            stmt = stmt.where(Lease.fecha_fin <= filters.expires_before)
        if filters.expires_after:
            stmt = stmt.where(Lease.fecha_fin >= filters.expires_after)
        return stmt

    async def search(
        self, 
        query_embedding: list[float], 
        limit: int,
        filenames: Optional[list[str]] = None,
        filters: Optional[QueryFilters] = None,
    ) -> Sequence[Chunk]:
        stmt = select(self.model)
        
        if filenames:
            stmt = stmt.join(Lease)
            stmt = stmt.where(Lease.filename.in_(filenames))

        if filters:
            if not filenames:
                stmt = stmt.join(Lease)
            stmt = self._apply_filters(stmt, filters)

        stmt = stmt.order_by(self.model.embedding.cosine_distance(query_embedding)).limit(limit)
        
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def delete_by_lease_id(self, lease_id: UUID) -> None:
        from sqlalchemy import delete
        await self.db.execute(delete(self.model).where(self.model.lease_id == lease_id))
        await self.db.commit()
