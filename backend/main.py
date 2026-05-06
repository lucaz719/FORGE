import asyncio
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import backend.state as state
from backend.models import JobRequest
from backend.websocket_hub import manager

load_dotenv(Path(__file__).with_name(".env"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.agents.executor import start_executor
    from backend.agents.strategist import start_strategist
    from backend.agents.watcher import start_watcher

    tasks = [
        asyncio.create_task(start_watcher(), name="forge-watcher"),
        asyncio.create_task(start_strategist(), name="forge-strategist"),
        asyncio.create_task(start_executor(), name="forge-executor"),
    ]
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="FORGE API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/submit-job")
async def submit_job(req: JobRequest):
    req.job_id = str(uuid.uuid4())[:8]
    state.jobs.append(req)
    await manager.broadcast({"type": "JOB_SUBMITTED", "job": req.model_dump(mode="json")})
    return {"job_id": req.job_id}


@app.get("/jobs")
async def get_jobs():
    return [job.model_dump(mode="json") for job in state.jobs]


@app.get("/ledger")
async def get_ledger():
    return [receipt.model_dump(mode="json") for receipt in state.receipts]


@app.get("/prices")
async def get_prices():
    current = state.price_history[-1].model_dump(mode="json") if state.price_history else {}
    history = [price.model_dump(mode="json") for price in state.price_history[-24:]]
    return {"current": current, "history": history}


@app.get("/savings")
async def get_savings():
    return [summary.model_dump(mode="json") for summary in state.savings.values()]


@app.post("/release-renter")
async def release_renter():
    state.active_subleases.clear()
    state.renter_idle_since.clear()
    await manager.broadcast({"type": "RENTER_RELEASED", "timestamp": datetime.utcnow().isoformat()})
    return {"success": True}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
