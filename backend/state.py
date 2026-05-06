import asyncio

from backend.models import ExecutionPlan, JobRequest, PriceTick, SavedSummary, SettlementReceipt

price_queue: asyncio.Queue = asyncio.Queue()
plan_queue: asyncio.Queue = asyncio.Queue()

jobs: list[JobRequest] = []
receipts: list[SettlementReceipt] = []
price_history: list[PriceTick] = []
active_plans: list[ExecutionPlan] = []
savings: dict[str, SavedSummary] = {
    "renter": SavedSummary(user_id="renter", saved_usd=0.0, pct_saved=0.0, renter_earned_usd=0.0),
    "batcher_a": SavedSummary(user_id="batcher_a", saved_usd=0.0, pct_saved=0.0, renter_earned_usd=0.0),
    "batcher_b": SavedSummary(user_id="batcher_b", saved_usd=0.0, pct_saved=0.0, renter_earned_usd=0.0),
    "solo": SavedSummary(user_id="solo", saved_usd=0.0, pct_saved=0.0, renter_earned_usd=0.0),
}
renter_idle_since: dict[str, float] = {}
active_subleases: dict[str, str] = {}
