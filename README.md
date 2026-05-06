# FORGE — Autonomous Compute Exchange

FORGE — Autonomous Compute Exchange: Agentic spot-price optimizer for AMD GPU workloads

## Hackathon Context

Built for the AMD Developer Hackathon, May 2026.

## Architecture

```text
+--------+      +---------------------------+      +-------------------------------+
|  User  | ---> | Frontend (Vite + React)   | ---> | FastAPI Backend               |
|        | <--- | Dashboard + Job Controls  | <--- | REST + WebSocket (/ws)        |
+--------+      +---------------------------+      +---------------+---------------+
                                                                    |
                                                                    v
                                                +---------------------------------------+
                                                | Agent Runtime                         |
                                                |  - Watcher Agent                      |
                                                |  - Strategist Agent                   |
                                                |  - Executor Agent                     |
                                                +-------------------+-------------------+
                                                                    |
                           +----------------------------------------+----------------------------------+
                           |                                                                           |
                           v                                                                           v
                +-------------------------------+                                         +-----------------------------+
                | AMD Dev Cloud                 |                                         | X402 Payments               |
                | Spot prices + GPU inference   |                                         | Micropayments + receipts    |
                +-------------------------------+                                         +-----------------------------+
```

## Why FORGE

- Reduces GPU spend by timing jobs against AMD spot-price movements.
- Batches compatible workloads to split instance cost across users.
- Subleases idle renter capacity instead of letting reserved compute sit unused.
- Streams agent decisions live over WebSockets for a demo-friendly dashboard.

## Repository Layout

- `backend/` — FastAPI API, WebSocket hub, agent runtime, AMD + X402 integrations.
- `frontend/` — Vite app with live dashboard panels, charts, and receipt feed.
- `scripts/demo_run.py` — automated 90-second demo scenario.
- `claude.md` — internal task progress log used during the hackathon build.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Git

## Quick Start

> Use port `8001` for local backend development. Port `8000` is already occupied in this environment.

```bash
# 1. Clone and enter
git clone <repo-url>
cd FORGE

# 2. Backend setup
cd backend
cp .env.example .env   # fill in AMD_API_KEY, wallet addresses
pip install -r requirements.txt
cd ..
uvicorn backend.main:app --host 0.0.0.0 --port 8001

# 3. Frontend setup (new terminal)
cd frontend
npm install
npm run dev

# 4. Run demo (optional, new terminal)
python scripts/demo_run.py
```

PowerShell users can replace `cp .env.example .env` with `Copy-Item .env.example .env`.

Set `frontend/.env` or your frontend host environment so `VITE_BACKEND_URL` points to `http://localhost:8001` during local development.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and provide real credentials before running a live demo.

| Variable | Description |
| --- | --- |
| `AMD_API_KEY` | AMD Dev Cloud API key used for live inference and spot-price polling. |
| `AMD_API_BASE` | Base URL for AMD Dev Cloud API requests. |
| `AMD_MODEL` | Default model identifier used when submitting inference jobs. |
| `WALLET_RENTER` | Wallet address credited when renter capacity is subleased. |
| `WALLET_BATCHER_A` | Wallet address for the first batcher persona in the demo. |
| `WALLET_BATCHER_B` | Wallet address for the second batcher persona in the demo. |
| `WALLET_SOLO` | Wallet address for the solo user persona. |
| `WALLET_AMD_PROVIDER` | Wallet address representing the AMD compute provider sink. |
| `OPENAI_API_KEY` | Optional LLM key for LangChain-powered reasoning strings and agent narration. |

## How It Works

FORGE uses three cooperating backend agents to turn live price signals into execution and settlement decisions.

### 1. Watcher Agent

- Polls AMD spot prices every 30 seconds.
- Detects idle Renter instances that have been unused past the configured threshold.
- Publishes `PriceTick` events so the rest of the system can react in real time.

### 2. Strategist Agent

- Consumes incoming price ticks and the queued jobs.
- Chooses `BATCH`, `WAIT`, `RUN_NOW`, or `SUBLEASED` based on price, deadlines, and capacity.
- Computes cost splits for grouped jobs and publishes plans to the execution queue.

### 3. Executor Agent

- Calls AMD inference for scheduled work.
- Triggers X402 micropayments for each settlement path.
- Generates `SettlementReceipt` records and broadcasts execution events to the UI.

## REST API

| Method | Path | Description |
| --- | --- | --- |
| POST | `/submit-job` | Submit a compute job |
| GET | `/jobs` | List all jobs |
| GET | `/ledger` | Settlement receipts |
| GET | `/prices` | Current spot prices |
| GET | `/savings` | Per-user savings summary |
| POST | `/release-renter` | Reclaim renter instance |
| WS | `/ws` | Live event stream |

## Deployment

FORGE is split into a static frontend and a Python backend, so deployment works best as two services.

### Frontend: Vercel

- Set the Vercel project root to `frontend/`.
- Add `VITE_BACKEND_URL` in the Vercel dashboard so the app points at your deployed API.
- Deploy from the `frontend` directory with:

```bash
cd frontend
vercel --prod
```

- The included `frontend/vercel.json` config uses Vite defaults:
  - `buildCommand`: `npm run build`
  - `outputDirectory`: `dist`
  - `framework`: `vite`

### Backend: Railway / Render / fly.io

- Deploy from the repository root.
- Use Python 3.11.
- Set the install command to `pip install -r backend/requirements.txt` if your platform does not detect nested requirements automatically.
- Start the service with:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

- The root `Procfile` and `runtime.txt` are included for platforms that honor them.
- Configure the same environment variables from `backend/.env.example` in your hosting dashboard.
- Keep WebSockets enabled so the dashboard can receive live agent events.

## Tech Stack

- FastAPI
- Pydantic v2
- LangChain
- X402
- AMD Dev Cloud
- Vite
- React 18
- TypeScript
- Recharts
- WebSockets

## Demo Flow

1. Start the backend on port `8001`.
2. Start the frontend and open the dashboard in a browser.
3. Submit or script demo jobs and watch the live price, batching, and receipt panels update over `/ws`.

## Notes for Judges and Reviewers

- The demo emphasizes savings visibility, settlement transparency, and clear agent reasoning.
- At least one live AMD API path should be configured for a compliant hackathon submission.
- Mock fallbacks keep the UI usable when API keys are unavailable during local development.

## Hackathon Note

FORGE was built for the AMD Developer Hackathon, May 2026, as an agentic marketplace for optimizing GPU workload execution costs.
