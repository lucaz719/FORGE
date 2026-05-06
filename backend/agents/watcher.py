import asyncio, time, os
from datetime import datetime
from backend.models import PriceTick, AgentEvent
from backend.websocket_hub import manager
import backend.state as state

INSTANCE_TYPES = ["MI300X", "MI250X", "MI100"]
RENTER_INSTANCE_ID = "renter-instance-01"
IDLE_THRESHOLD_MINUTES = 15
POLL_INTERVAL_SECONDS = 30


async def start_watcher():
    """
    Watcher Agent — polls AMD spot prices every 30s, detects idle Renter instances,
    publishes PriceTick to price_queue, broadcasts blue AgentEvents via WebSocket.
    """
    # Register Renter instance as idle from startup (for demo)
    state.renter_idle_since[RENTER_INSTANCE_ID] = time.time() - (IDLE_THRESHOLD_MINUTES + 1) * 60

    prev_prices: dict[str, float] = {}

    while True:
        from backend.amd_client import amd_client

        for instance_type in INSTANCE_TYPES:
            try:
                price = await amd_client.get_spot_price(instance_type)
            except Exception:
                import random
                price = round({"MI300X": 3.50, "MI250X": 2.20, "MI100": 1.10}.get(instance_type, 3.50) * (1 + random.uniform(-0.15, 0.15)), 4)

            prev = prev_prices.get(instance_type)
            if prev is None:
                trend = "FLAT"
            elif price > prev:
                trend = "UP"
            elif price < prev:
                trend = "DOWN"
            else:
                trend = "FLAT"
            prev_prices[instance_type] = price

            tick = PriceTick(
                instance_type=instance_type,
                spot_price_usd=price,
                timestamp=datetime.utcnow(),
                trend=trend,
            )
            state.price_history.append(tick)
            if len(state.price_history) > 200:
                state.price_history.pop(0)

            await state.price_queue.put(tick)

            await manager.broadcast({"type": "PRICE", "tick": tick.model_dump(mode="json")})

        # Check Renter idle status
        now = time.time()
        idle_alerts = []
        for inst_id, idle_since in list(state.renter_idle_since.items()):
            idle_minutes = (now - idle_since) / 60
            if idle_minutes >= IDLE_THRESHOLD_MINUTES and inst_id not in state.active_subleases:
                idle_alerts.append(f"{inst_id} idle {idle_minutes:.0f}m — available for sub-lease")

        mi300x_price = prev_prices.get("MI300X", 3.50)
        trend_word = {"UP": "rising ↑", "DOWN": "falling ↓", "FLAT": "stable →"}.get(
            "UP" if mi300x_price > 3.50 else ("DOWN" if mi300x_price < 3.50 else "FLAT"), "stable →"
        )

        if idle_alerts:
            msg = (
                f"Price scan: MI300X ${mi300x_price:.4f}/hr ({trend_word}). "
                f"Idle capacity detected — {'; '.join(idle_alerts)}. Flagging for Strategist."
            )
        else:
            msg = (
                f"Price scan complete — MI300X ${mi300x_price:.4f}/hr ({trend_word}), "
                f"MI250X ${prev_prices.get('MI250X', 2.20):.4f}/hr. No idle capacity. Monitoring."
            )

        event = AgentEvent(
            agent="watcher",
            message=msg,
            colour="blue",
            timestamp=datetime.utcnow(),
        )
        await manager.broadcast({"type": "AGENT", "event": event.model_dump(mode="json")})

        await asyncio.sleep(POLL_INTERVAL_SECONDS)
