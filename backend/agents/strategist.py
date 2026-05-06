import asyncio, uuid
from datetime import datetime
from itertools import groupby

from backend.models import ExecutionPlan, AgentEvent
from backend.websocket_hub import manager
import backend.state as state


# Track which job_ids have already been assigned to a plan
_planned_job_ids: set[str] = set()


async def start_strategist():
    """
    Strategist Agent — consumes PriceTicks from price_queue, evaluates pending jobs,
    decides BATCH | WAIT | RUN_NOW | SUBLEASED, publishes ExecutionPlan to plan_queue,
    broadcasts yellow AgentEvents via WebSocket.
    """
    while True:
        tick = await state.price_queue.get()

        # Jobs not yet assigned to any plan
        unplanned = [j for j in state.jobs if j.job_id not in _planned_job_ids]

        if not unplanned:
            await asyncio.sleep(1)
            continue

        flexible = [j for j in unplanned if j.deadline_window_hours > 0]
        urgent   = [j for j in unplanned if j.deadline_window_hours == 0]

        decisions: list[tuple[ExecutionPlan, str]] = []  # (plan, reasoning_msg)

        # ── Batch flexible jobs by instance_type ──────────────────────────────
        flexible_sorted = sorted(flexible, key=lambda j: j.instance_type)
        for inst_type, grp in groupby(flexible_sorted, key=lambda j: j.instance_type):
            group = list(grp)
            spot = tick.spot_price_usd if tick.instance_type == inst_type else _lookup_price(inst_type)

            if len(group) >= 2:
                n = len(group)
                total_hours = max(j.estimated_hours for j in group)
                total_cost  = round(spot * total_hours, 4)
                cost_each   = round(total_cost / n, 4)
                solo_cost   = round(spot * total_hours, 4)
                saving_pct  = round((1 - 1 / n) * 100)

                plan = ExecutionPlan(
                    plan_id=str(uuid.uuid4())[:8],
                    job_ids=[j.job_id for j in group],
                    strategy="BATCH",
                    instance_type=inst_type,
                    cost_per_job_usd=cost_each,
                    total_cost_usd=total_cost,
                    spot_price_usd=spot,
                )
                msg = (
                    f"BATCH: {n} jobs matched on {inst_type} — "
                    f"each pays ${cost_each:.4f} (solo rate ${solo_cost:.4f}, saving {saving_pct}%). "
                    f"Spot: ${spot:.4f}/hr. Dispatching to Executor."
                )
                decisions.append((plan, msg))

            else:  # single flexible job — wait for batch partner
                j = group[0]
                cost = round(spot * j.estimated_hours, 4)
                plan = ExecutionPlan(
                    plan_id=str(uuid.uuid4())[:8],
                    job_ids=[j.job_id],
                    strategy="WAIT",
                    instance_type=inst_type,
                    cost_per_job_usd=cost,
                    total_cost_usd=cost,
                    spot_price_usd=spot,
                )
                msg = (
                    f"WAIT: 1 flexible job on {inst_type} (deadline {j.deadline_window_hours}h window). "
                    f"Holding for batch partner. Current spot: ${spot:.4f}/hr. "
                    f"Estimated solo cost if no match: ${cost:.4f}."
                )
                decisions.append((plan, msg))

        # ── Urgent jobs run immediately ────────────────────────────────────────
        for j in urgent:
            spot = tick.spot_price_usd if tick.instance_type == j.instance_type else _lookup_price(j.instance_type)
            cost = round(spot * j.estimated_hours, 4)
            plan = ExecutionPlan(
                plan_id=str(uuid.uuid4())[:8],
                job_ids=[j.job_id],
                strategy="RUN_NOW",
                instance_type=j.instance_type,
                cost_per_job_usd=cost,
                total_cost_usd=cost,
                spot_price_usd=spot,
            )
            msg = (
                f"RUN_NOW: Urgent job {j.job_id} from {j.user_id} on {j.instance_type}. "
                f"Executing at spot rate ${spot:.4f}/hr — estimated cost ${cost:.4f}. No delay."
            )
            decisions.append((plan, msg))

        # ── Sub-lease idle Renter capacity ────────────────────────────────────
        import time as _time
        now = _time.time()
        for inst_id, idle_since in list(state.renter_idle_since.items()):
            idle_minutes = (now - idle_since) / 60
            if idle_minutes >= 15 and inst_id not in state.active_subleases and unplanned:
                j = unplanned[0]  # route first pending job to sub-lease
                spot = tick.spot_price_usd
                cost = round(spot * j.estimated_hours * 0.85, 4)  # 15% discount via sub-lease
                plan = ExecutionPlan(
                    plan_id=str(uuid.uuid4())[:8],
                    job_ids=[j.job_id],
                    strategy="SUBLEASED",
                    instance_type=j.instance_type,
                    cost_per_job_usd=cost,
                    total_cost_usd=cost,
                    spot_price_usd=spot,
                )
                state.active_subleases[inst_id] = j.job_id
                msg = (
                    f"SUBLEASED: Renter instance {inst_id} idle {idle_minutes:.0f}m — "
                    f"routing job {j.job_id} at 15% discount (${cost:.4f} vs ${round(spot*j.estimated_hours,4):.4f}). "
                    f"Renter earns passive credit."
                )
                decisions.append((plan, msg))

        # ── Dispatch all non-WAIT plans ────────────────────────────────────────
        for plan, msg in decisions:
            # Mark job_ids as planned
            for jid in plan.job_ids:
                _planned_job_ids.add(jid)

            event = AgentEvent(
                agent="strategist",
                message=msg,
                colour="yellow",
                timestamp=datetime.utcnow(),
            )
            await manager.broadcast({"type": "AGENT", "event": event.model_dump(mode="json")})
            await manager.broadcast({"type": "PLAN", "plan": plan.model_dump()})

            if plan.strategy != "WAIT":
                await state.plan_queue.put(plan)


def _lookup_price(instance_type: str) -> float:
    """Get last known price for an instance type from history, fallback to base rates."""
    for tick in reversed(state.price_history):
        if tick.instance_type == instance_type:
            return tick.spot_price_usd
    return {"MI300X": 3.50, "MI250X": 2.20, "MI100": 1.10}.get(instance_type, 3.50)
