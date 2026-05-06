from datetime import datetime

from pydantic import BaseModel


class JobRequest(BaseModel):
    job_id: str = ""
    user_id: str
    model: str
    instance_type: str
    estimated_hours: float
    deadline_window_hours: float


class SettlementReceipt(BaseModel):
    receipt_hash: str
    user_id: str
    amount_usd: float
    strategy: str
    timestamp: datetime
    job_id: str


class PriceTick(BaseModel):
    instance_type: str
    spot_price_usd: float
    timestamp: datetime
    trend: str


class AgentEvent(BaseModel):
    agent: str
    message: str
    colour: str
    timestamp: datetime


class SavedSummary(BaseModel):
    user_id: str
    saved_usd: float
    pct_saved: float
    renter_earned_usd: float


class ExecutionPlan(BaseModel):
    plan_id: str
    job_ids: list[str]
    strategy: str
    instance_type: str
    cost_per_job_usd: float
    total_cost_usd: float
    spot_price_usd: float
