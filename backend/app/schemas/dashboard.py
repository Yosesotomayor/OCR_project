from pydantic import BaseModel
from typing import Optional


class StateRevenue(BaseModel):
    estado: str
    revenue: float


class MonthlyExpiration(BaseModel):
    month: str  # Format: YYYY-MM
    count: int


class DashboardStats(BaseModel):
    total_mrr: float
    active_contracts: int
    upcoming_expirations: int
    active_percentage: float
    revenue_by_state: list[StateRevenue]
    expirations_by_month: list[MonthlyExpiration]


class DashboardParams(BaseModel):
    horizon_days: Optional[int] = 30
