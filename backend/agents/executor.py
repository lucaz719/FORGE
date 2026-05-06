import asyncio, os
from datetime import datetime

from backend.models import SettlementReceipt, AgentEvent
from backend.websocket_hub import manager
import backend.state as state

WALLET_MAP_ENV = {
    "renter":    "WALLET_RENTER",
    "batcher_a": "WALLET_BATCHER_A",
    "batcher_b": "WALLET_BATCHER_B",
    "solo":      "WALLET_SOLO",
}

async def start_executor():
    """
    Executor Agent — consumes ExecutionPlans from plan_queue, fires real AMD inference,
    triggers X402 micropayment per job, generates SettlementReceipts, broadcasts green events.
    Handles REFUND on failure. Exponential backoff retry (max 3 attempts).
    """
    while True:
        plan = await state.plan_queue.get()

        from backend.amd_client import amd_client
        from backend.payments.x402_client import x402_client

        jobs_in_plan = [j for j in state.jobs if j.job_id in plan.job_ids]
        if not jobs_in_plan:
            continue

        # Announce execution start
        await _broadcast_event(
            f"Executing plan {plan.plan_id} [{plan.strategy}] — "
            f"{len(jobs_in_plan)} job(s) on {plan.instance_type} @ ${plan.spot_price_usd:.4f}/hr. "
            f"Firing AMD inference call..."
        )

        # ── AMD Inference call (with retry) ───────────────────────────────────
        prompt = (
            f"[FORGE {plan.strategy}] Batch of {len(jobs_in_plan)} job(s) on "
            f"{plan.instance_type}. Model: {jobs_in_plan[0].model}. "
            f"Confirm compute allocation and return job receipt."
        )
        inference_result = None
        last_error = None
        for attempt in range(1, 4):
            try:
                inference_result = await amd_client.run_inference(
                    prompt=prompt,
                    model=jobs_in_plan[0].model,
                )
                break
            except Exception as e:
                last_error = e
                await _broadcast_event(
                    f"AMD inference attempt {attempt}/3 failed: {e}. "
                    + ("Retrying..." if attempt < 3 else "Giving up — issuing refunds.")
                )
                await asyncio.sleep(2 ** attempt)

        if inference_result is None:
            # Refund all jobs
            for job in jobs_in_plan:
                refund_hash = await x402_client.refund(job.user_id, plan.cost_per_job_usd, job.job_id)
                await _broadcast_event(
                    f"REFUND issued — job {job.job_id} ({job.user_id}): "
                    f"${plan.cost_per_job_usd:.4f} returned. Hash: {refund_hash[:14]}..."
                )
            continue

        is_mock = inference_result.get("_mock", False)
        await _broadcast_event(
            f"AMD inference {'(mock)' if is_mock else '(REAL ✓)'} complete for plan {plan.plan_id}. "
            f"Settling {len(jobs_in_plan)} X402 payment(s)..."
        )

        # ── X402 settlement per job ────────────────────────────────────────────
        provider_wallet = os.getenv("WALLET_AMD_PROVIDER", "0xAMDProvider")

        for job in jobs_in_plan:
            from_wallet = os.getenv(WALLET_MAP_ENV.get(job.user_id, ""), f"0x{job.user_id}")

            receipt_hash = await x402_client.pay(
                from_wallet=from_wallet,
                to_wallet=provider_wallet,
                amount_usd=plan.cost_per_job_usd,
                job_id=job.job_id,
                event_type="BATCH_SPLIT" if plan.strategy == "BATCH" else plan.strategy,
            )

            receipt = SettlementReceipt(
                receipt_hash=receipt_hash,
                user_id=job.user_id,
                amount_usd=plan.cost_per_job_usd,
                strategy=plan.strategy,
                timestamp=datetime.utcnow(),
                job_id=job.job_id,
            )
            state.receipts.append(receipt)
            await manager.broadcast({"type": "RECEIPT", "receipt": receipt.model_dump(mode="json")})

            # ── Update savings ─────────────────────────────────────────────────
            solo_cost = round(plan.spot_price_usd * job.estimated_hours, 4)
            saved_usd = max(0.0, round(solo_cost - plan.cost_per_job_usd, 4))
            pct_saved = round((saved_usd / solo_cost * 100) if solo_cost > 0 else 0.0, 1)

            s = state.savings.get(job.user_id)
            if s:
                s.saved_usd  = round(s.saved_usd + saved_usd, 4)
                s.pct_saved  = pct_saved

            await manager.broadcast({
                "type": "SAVINGS",
                "summary": [sv.model_dump() for sv in state.savings.values()],
            })

            await _broadcast_event(
                f"Settled {job.user_id} job {job.job_id} — "
                f"${plan.cost_per_job_usd:.4f} via X402 [{plan.strategy}]. "
                f"Receipt: {receipt_hash[:16]}... Saved: ${saved_usd:.4f} ({pct_saved}%)."
            )

        # ── Renter credit for SUBLEASED ────────────────────────────────────────
        if plan.strategy == "SUBLEASED":
            renter_credit = round(plan.total_cost_usd * 0.70, 4)
            r = state.savings.get("renter")
            if r:
                r.renter_earned_usd = round(r.renter_earned_usd + renter_credit, 4)
            await manager.broadcast({
                "type": "SAVINGS",
                "summary": [sv.model_dump() for sv in state.savings.values()],
            })
            await _broadcast_event(
                f"Renter credited ${renter_credit:.4f} for sub-leased capacity on plan {plan.plan_id}."
            )


async def _broadcast_event(message: str):
    event = AgentEvent(
        agent="executor",
        message=message,
        colour="green",
        timestamp=datetime.utcnow(),
    )
    await manager.broadcast({"type": "AGENT", "event": event.model_dump(mode="json")})
