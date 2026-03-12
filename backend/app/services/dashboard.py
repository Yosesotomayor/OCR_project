from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_, or_, text
from app.models.lease import LeaseStatus
from app.repositories.lease_repo import LeaseRepo
from app.schemas.dashboard import DashboardStats, StateRevenue, MonthlyExpiration


class DashboardService:
    def __init__(self, lease_repo: LeaseRepo):
        self.lease_repo = lease_repo
    
    async def get_stats(self, horizon_days: int = 30) -> DashboardStats:
        now = datetime.now(timezone.utc)
        horizon_date = now + timedelta(days=horizon_days)
        repo = self.lease_repo

        # Base filter for ready leases
        is_ready = repo.model.status == LeaseStatus.READY
        
        # Active filter: Ready AND (start <= now OR start IS NULL) AND (end >= now OR end IS NULL)
        is_active = and_(
            is_ready,
            or_(repo.model.fecha_inicio <= now, repo.model.fecha_inicio.is_(None)),
            or_(repo.model.fecha_fin >= now, repo.model.fecha_fin.is_(None))
        )

        # 1. Total MRR (Sum of active leases' monthly rent)
        mrr_query = select(func.sum(repo.model.renta_mensual)).where(is_active)
        mrr_result = await repo.db.execute(mrr_query)
        total_mrr = float(mrr_result.scalar() or 0.0)

        # 2. Active Contracts Count
        active_count_query = select(func.count(repo.model.id)).where(is_active)
        active_count_result = await repo.db.execute(active_count_query)
        active_contracts = active_count_result.scalar() or 0

        # 3. Total READY Contracts (for percentage)
        total_ready_query = select(func.count(repo.model.id)).where(is_ready)
        total_ready_result = await repo.db.execute(total_ready_query)
        total_ready = total_ready_result.scalar() or 0

        # 4. Upcoming Expirations
        upcoming_query = select(func.count(repo.model.id)).where(
            and_(
                is_ready,
                repo.model.fecha_fin >= now,
                repo.model.fecha_fin <= horizon_date
            )
        )
        upcoming_result = await repo.db.execute(upcoming_query)
        upcoming_expirations = upcoming_result.scalar() or 0

        # 5. Revenue by State
        revenue_state_query = (
            select(repo.model.estado, func.sum(repo.model.renta_mensual))
            .where(is_active)
            .group_by(repo.model.estado)
        )
        revenue_state_result = await repo.db.execute(revenue_state_query)
        revenue_by_state = [
            {"estado": row[0] or "Unknown", "revenue": float(row[1] or 0.0)}
            for row in revenue_state_result.all()
        ]

        # 6. Expirations by Month of the next 12 months
        # PostgreSQL to_char(fecha_fin, 'YYYY-MM')
        final_date = now + timedelta(days=365)
        months = select(
            func.to_char(
                func.generate_series(
                    func.date_trunc('month', now),
                    func.date_trunc('month', final_date),
                    text("interval '1 month'")
                ),
                'YYYY-MM'
            ).label("month")
        ).subquery()

        expirations_month_query = (
            select(
                months.c.month,
                func.count(repo.model.id).label("count")
            )
            .select_from(months)
            .join(
                repo.model,
                and_(
                    func.to_char(repo.model.fecha_fin, 'YYYY-MM') == months.c.month,
                    is_ready,
                    repo.model.fecha_fin.isnot(None),
                    repo.model.fecha_fin <= final_date,
                ),
                isouter=True
            )
            .group_by(months.c.month)
            .order_by(months.c.month)
        )
        expirations_month_result = await repo.db.execute(expirations_month_query)
        expirations_by_month = [
            {"month": row[0], "count": row[1]}
            for row in expirations_month_result.all()
        ]

        active_percentage = (active_contracts / total_ready * 100) if total_ready > 0 else 0.0

        return DashboardStats(
            total_mrr=total_mrr,
            active_contracts=active_contracts,
            upcoming_expirations=upcoming_expirations,
            active_percentage=active_percentage,
            revenue_by_state=[
                StateRevenue(estado=item["estado"], revenue=item["revenue"])
                for item in revenue_by_state
            ],
            expirations_by_month=[
                MonthlyExpiration(month=item["month"], count=item["count"])
                for item in expirations_by_month
            ]
        )