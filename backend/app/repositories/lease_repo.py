from typing import Sequence
from sqlalchemy import select
from app.models.lease import Lease, LeaseStatus
from app.repositories.base import BaseRepo

class LeaseRepo(BaseRepo[Lease]):
    def __init__(self, db):
        super().__init__(Lease, db)

    async def list_ordered(self) -> Sequence[Lease]:
        result = await self.db.execute(
            select(self.model)
            .order_by(self.model.created_at.desc())
        )
        return result.scalars().all()

    async def list_failed(self) -> Sequence[Lease]:
        result = await self.db.execute(
            select(self.model)
            .where(self.model.status == LeaseStatus.FAILED)
            .order_by(self.model.created_at.desc())
        )
        return result.scalars().all()