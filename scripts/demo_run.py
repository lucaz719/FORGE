#!/usr/bin/env python3
"""
FORGE 90-second Demo Script
Submits scripted jobs to demonstrate BATCH, RUN_NOW, and SUBLEASED strategies.
Run from project root: python scripts/demo_run.py
"""
import asyncio
import httpx
import time

BACKEND = "http://localhost:8001"
start = 0.0


async def submit_job(client, user_id, instance_type="MI300X", hours=0.5, deadline=2.0):
    resp = await client.post(f"{BACKEND}/submit-job", json={
        "user_id": user_id,
        "model": "meta-llama/Llama-3.1-8B-Instruct",
        "instance_type": instance_type,
        "estimated_hours": hours,
        "deadline_window_hours": deadline,
    })
    data = resp.json()
    job_id = data.get("job_id", "ERROR")
    print(f"  [T+{time.time()-start:4.0f}s] ✉  {user_id:12s} → job_id={job_id}")
    return job_id


async def check(client, endpoint):
    resp = await client.get(f"{BACKEND}/{endpoint}")
    data = resp.json()
    if isinstance(data, list):
        print(f"  [T+{time.time()-start:4.0f}s] 📋 /{endpoint:<16} → {len(data)} items")
    elif isinstance(data, dict):
        keys = list(data.keys())
        print(f"  [T+{time.time()-start:4.0f}s] 📋 /{endpoint:<16} → {keys}")
    return data


async def run_demo():
    global start
    start = time.time()
    print("=" * 60)
    print("  FORGE — Autonomous Compute Exchange  |  Demo Run")
    print("=" * 60)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Verify backend
        try:
            await client.get(f"{BACKEND}/jobs")
            print(f"  [T+0s] ✅ Backend connected at {BACKEND}")
        except Exception as e:
            print(f"  ERROR: Cannot reach backend: {e}")
            print(f"  Start it with: uvicorn backend.main:app --port 8001")
            return

        # ── Phase 1: BATCH ────────────────────────────────────────
        print("\n  ── Phase 1: BATCH matching (Batcher A + B) ─────────")
        await submit_job(client, "batcher_a", instance_type="MI300X", hours=0.5, deadline=2.0)
        await asyncio.sleep(2)
        await submit_job(client, "batcher_b", instance_type="MI300X", hours=0.5, deadline=2.0)
        print(f"  Waiting for Strategist BATCH decision + Executor (~35s)...")
        await asyncio.sleep(35)
        await check(client, "ledger")
        await check(client, "savings")

        # ── Phase 2: RUN_NOW ──────────────────────────────────────
        print("\n  ── Phase 2: RUN_NOW (Solo urgent job) ───────────────")
        await submit_job(client, "solo", instance_type="MI300X", hours=0.25, deadline=0.0)
        print(f"  Waiting for Executor to settle Solo job (~35s)...")
        await asyncio.sleep(35)
        await check(client, "ledger")
        await check(client, "savings")

        # ── Phase 3: Renter kill-switch ───────────────────────────
        print("\n  ── Phase 3: Renter kill-switch ──────────────────────")
        resp = await client.post(f"{BACKEND}/release-renter")
        print(f"  [T+{time.time()-start:4.0f}s] 🔑 POST /release-renter → {resp.json()}")
        await asyncio.sleep(3)

        # ── Final state ───────────────────────────────────────────
        print("\n  ── Final State ──────────────────────────────────────")
        ledger  = await check(client, "ledger")
        savings = await check(client, "savings")
        prices  = await check(client, "prices")

        elapsed = time.time() - start
        receipts_count = len(ledger) if isinstance(ledger, list) else 0

        print(f"\n{'=' * 60}")
        print(f"  Demo complete in {elapsed:.0f}s")
        print(f"  Receipts in ledger : {receipts_count}")
        if isinstance(savings, list):
            for s in savings:
                saved = s.get("saved_usd", 0)
                earned = s.get("renter_earned_usd", 0)
                pct = s.get("pct_saved", 0)
                if saved > 0 or earned > 0:
                    uid = s["user_id"].replace("_", " ")
                    print(f"  {uid:12s} : saved=${saved:.4f} ({pct:.1f}%)  earned=${earned:.4f}")
        target = "✅ PASS" if receipts_count >= 1 else "❌ FAIL (no receipts)"
        print(f"  Demo gate          : {target}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_demo())
