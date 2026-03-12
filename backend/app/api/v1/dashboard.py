from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_active_user, get_dashboard_service
from app.schemas.dashboard import DashboardStats
from app.services.dashboard import DashboardService

router = APIRouter(
    prefix="/dashboard", 
    tags=["dashboard"],
    dependencies=[Depends(get_current_active_user)],
)

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    horizon_days: int = Query(30, description="Horizon in days for upcoming expirations"),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> DashboardStats:
    return await dashboard_service.get_stats(horizon_days=horizon_days)
