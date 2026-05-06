# FORGE — Orchestral Agent Task List
## Autonomous Compute Exchange · Layer 1 · Hackathon Build (May 11–19, 2026)

---

## Overview

This document divides the FORGE Layer 1 build into **11 specialist agents**, each owning a discrete scope.  
Agents run in dependency order (parallel where possible). **Agent K (Verifier)** is the final gate.

```
[PARALLEL WAVE 1 — Day 1]
  Agent A: Backend Core ──────────────────────────────┐
  Agent B: AMD Client  ───────────────────────────────┤
  Agent G: Frontend Core ─────────────────────────────┘

[PARALLEL WAVE 2 — Day 2-3]
  Agent C: Watcher Agent     (needs A + B) ───────────┐
  Agent D: Strategist Agent  (needs A + C) ───────────┤
  Agent F: X402 Payments     (parallel)   ───────────┤
  Agent H: Frontend UI       (needs G)    ───────────┘

[SEQUENTIAL WAVE 3 — Day 3]
  Agent E: Executor Agent  (needs A + B + D + F)

[SEQUENTIAL WAVE 4 — Day 4-5]
  Agent I: Integration     (needs E + H)

[PARALLEL WAVE 5 — Day 7]
  Agent J: DevOps & Deploy (needs I) ─────────────────┐
  Agent K: Verifier & QA   (needs I) ─────────────────┘
```

---

## Agent Definitions

---

### 🔵 Agent A — Backend Core
**Role:** Backend Architect  
**Day:** 1  
**Depends On:** Nothing  

**Deliverables:**
- `backend/main.py` — FastAPI app with Uvicorn
- `backend/models.py` — all Pydantic v2 data contracts
- `backend/websocket_hub.py` — ConnectionManager with `broadcast(event)`
- All 6 REST endpoints registered (stubs OK on Day 1)
- `.env` loading via `python-dotenv`
- CORS middleware

**Data Contracts to Define:**
```python
class JobRequest(BaseModel):
    user_id: str          # renter | batcher_a | batcher_b | solo
    model: str
    instance_type: str
    estimated_hours: float
    deadline_window_hours: float  # 0 = immediate
    
class SettlementReceipt(BaseModel):
    receipt_hash: str
    user_id: str
    amount_usd: float
    strategy: str         # BATCH | SOLO | SUBLEASED
    timestamp: datetime
    job_id: str

class PriceTick(BaseModel):
    instance_type: str
    spot_price_usd: float
    timestamp: datetime
    trend: str            # UP | DOWN | FLAT

class AgentEvent(BaseModel):
    agent: str            # watcher | strategist | executor
    message: str
    colour: str           # blue | yellow | green
    timestamp: datetime

class SavedSummary(BaseModel):
    user_id: str
    saved_usd: float
    pct_saved: float
    renter_earned_usd: float
```

**REST Endpoints:**
```
POST /submit-job       → accepts JobRequest, returns job_id
GET  /jobs             → returns list of active JobRequest[]
GET  /ledger           → returns SettlementReceipt[]
GET  /prices           → returns PriceTick (current) + last 2h history
GET  /savings          → returns SavedSummary[] per user
POST /release-renter   → Renter kill-switch; reclaims instance immediately
WS   /ws               → streams AgentEvent, PriceTick, SettlementReceipt in real time
```

**Definition of Done:**
- `uvicorn backend.main:app --reload` starts without errors
- `GET /prices` returns a valid `PriceTick` JSON
- WebSocket client can connect to `/ws` and receive a heartbeat

---

### 🔵 Agent B — AMD Client
**Role:** Infrastructure Engineer  
**Day:** 1  
**Depends On:** Nothing  

**Deliverables:**
- `backend/amd_client.py`

**Implementation:**
```python
class AMDClient:
    async def run_inference(self, prompt: str, model: str) -> dict:
        # Tries real AMD API first; falls back to mock
        ...
    
    async def get_spot_price(self, instance_type: str) -> float:
        # Returns current price; ±15% variance simulation if API unavailable
        ...
    
    async def check_idle(self, instance_id: str) -> bool:
        # Returns True if instance idle >15 minutes
        ...
```

**Real API:** `AMD_API_BASE` + `Bearer AMD_API_KEY`  
**Model:** `AMD_MODEL` env var (default: `meta-llama/Llama-3.1-8B-Instruct`)  
**Mock Trigger:** `AMD_API_KEY` not set OR connection error  
**Mock Prices:** Base price per instance type × (1 ± 0.15 × random)  

**Definition of Done:**
- With valid `AMD_API_KEY`: returns real inference response
- Without key: returns mock response in identical shape
- `get_spot_price("MI300X")` returns a float in both modes

---

### 🟡 Agent C — Watcher Agent
**Role:** Market Observer  
**Day:** 2  
**Depends On:** Agent A (Backend Core), Agent B (AMD Client)  

**Deliverables:**
- `backend/agents/watcher.py`

**Behaviour:**
1. Runs as `asyncio` task on app startup
2. Every 30 seconds: calls `amd_client.get_spot_price()` for all instance types
3. Publishes `PriceTick` → `price_queue`
4. Checks Renter instances for idle time > 15 min; publishes `IDLE_DETECTED` event
5. Broadcasts `AgentEvent(agent="watcher", colour="blue", message=<llm_reasoning>)` via WebSocket
6. LLM reasoning: brief plain-English explanation of what it observed (max 50 tokens)

**Queue Contract:**
```python
price_queue: asyncio.Queue[PriceTick]  # Watcher → Strategist
```

**Definition of Done:**
- Agent starts on `app.on_event("startup")`
- WebSocket clients see blue Watcher events every ~30s
- `price_queue` fills with valid `PriceTick` objects

---

### 🟡 Agent D — Strategist Agent
**Role:** Decision Maker  
**Day:** 2  
**Depends On:** Agent A (Backend Core), Agent C (Watcher)  

**Deliverables:**
- `backend/agents/strategist.py`

**Behaviour:**
1. Consumes from `price_queue` and watches `job_queue` (jobs submitted by users)
2. **Batch detection algorithm:**
   - Group pending jobs where `instance_type` matches AND `deadline_window_hours > 0`
   - If 2+ compatible jobs found → decision = `BATCH`
   - If 1 job, `deadline_window_hours > 0` → decision = `WAIT`
   - If 1 job, `deadline_window_hours == 0` → decision = `RUN_NOW`
   - If Renter idle detected → decision = `SUBLEASED`
3. Computes cost split: `spot_price × estimated_hours ÷ n_jobs`
4. Publishes `ExecutionPlan` → `plan_queue`
5. Broadcasts `AgentEvent(agent="strategist", colour="yellow")` via WebSocket

**Queue Contract:**
```python
plan_queue: asyncio.Queue[ExecutionPlan]  # Strategist → Executor

class ExecutionPlan(BaseModel):
    job_ids: list[str]
    strategy: str       # BATCH | WAIT | RUN_NOW | SUBLEASED
    instance_type: str
    cost_per_job_usd: float
    total_cost_usd: float
```

**Definition of Done:**
- Submit 2 Batcher jobs with same `instance_type` and `deadline_window_hours > 0` → `BATCH` decision fires
- Submit 1 Solo job with `deadline_window_hours == 0` → `RUN_NOW` fires immediately
- Yellow Strategist events appear in WebSocket stream with cost breakdown

---

### 🟢 Agent E — Executor Agent
**Role:** Job Runner & Settlement Engine  
**Day:** 3  
**Depends On:** Agent A, Agent B, Agent D, Agent F  

**Deliverables:**
- `backend/agents/executor.py`

**Behaviour:**
1. Consumes `ExecutionPlan` from `plan_queue`
2. Calls `amd_client.run_inference()` (real AMD API call)
3. Triggers X402 payment via `x402_client.pay()` for each job in plan
4. Generates `SettlementReceipt` per job, stores in `receipts[]`
5. Broadcasts receipt via WebSocket (all panels update)
6. On failure: triggers `REFUND` payment event, broadcasts `REFUND_EVENT`
7. Broadcasts `AgentEvent(agent="executor", colour="green")` per action

**Definition of Done:**
- Real AMD inference call fires and returns response (check logs)
- `GET /ledger` returns at least one `SettlementReceipt`
- X402 receipt hash appears in WebSocket stream within 1 second of AMD call completing
- `REFUND` flow tested: failed job → full amount returned

---

### 💜 Agent F — X402 Payments
**Role:** Payment Engineer  
**Day:** 3 (parallel with E)  
**Depends On:** Nothing  

**Deliverables:**
- `backend/payments/x402_client.py`
- `backend/payments/__init__.py`

**Implementation Priority:**
1. ⏱️ **4-hour timebox:** Attempt real `x402-python` on Base Sepolia testnet
2. 🔄 **Auto-fallback:** If real integration fails, switch to mock

**Mock Contract:**
```python
async def pay(self, from_wallet: str, to_wallet: str, amount_usd: float, job_id: str) -> str:
    # Returns receipt_hash (deterministic: sha256(job_id + timestamp))
    # 300ms simulated latency
    ...
```

**Definition of Done:**
- `pay()` returns a non-empty receipt hash string
- Both real and mock paths produce identical-shaped output
- `BATCH_SPLIT` event correctly charges each batcher `spot × hours ÷ n`

---

### ✅ Agent G — Frontend Core
**Role:** Frontend Architect  
**Day:** 1 (parallel)  
**Depends On:** Nothing  

**Deliverables:**
- `frontend/` — Vite + React 18 + TypeScript 5 project
- `frontend/src/hooks/useSocket.ts` — WebSocket hook
- `frontend/src/types/events.ts` — all TypeScript event interfaces
- `frontend/src/components/UserSwitcher.tsx`
- 4-panel layout skeleton (CSS grid or Tailwind)

**useSocket Contract:**
```typescript
interface UseSocketReturn {
  lastEvent: ForgeEvent | null;
  connected: boolean;
}

function useSocket(url: string): UseSocketReturn {
  // auto-reconnect with 500ms exponential backoff
  // dispatches events to subscribers
}
```

**TypeScript Event Types:**
```typescript
type AgentEvent = { type: 'AGENT'; agent: 'watcher'|'strategist'|'executor'; message: string; colour: string; timestamp: string }
type ReceiptEvent = { type: 'RECEIPT'; receipt: SettlementReceipt }
type PriceEvent = { type: 'PRICE'; tick: PriceTick }
type SavingsEvent = { type: 'SAVINGS'; summary: SavedSummary[] }
type ForgeEvent = AgentEvent | ReceiptEvent | PriceEvent | SavingsEvent
```

**Definition of Done:**
- `npm run dev` starts without errors
- 4 empty panels visible at `localhost:5173`
- User switcher changes selected user
- `useSocket` connects to backend WS and logs events to console

**Completion Notes:**
- Initialized `frontend/` with Vite React + TypeScript and installed `recharts`.
- Added typed event contracts, auto-reconnecting `useSocket`, user switcher, `.env`, and a responsive 4-panel dashboard shell.
- Verified production build with `npm run build` ✅.

---

### ⚪ Agent H — Frontend UI Panels
**Role:** UI Engineer  
**Day:** 2–3  
**Depends On:** Agent G (Frontend Core)  

**Deliverables:**
- `frontend/src/components/JobSubmit.tsx`
- `frontend/src/components/LiveLedger.tsx`
- `frontend/src/components/SavingsCounter.tsx`
- `frontend/src/components/AgentActivityLog.tsx`
- `frontend/src/components/BatchView.tsx`
- `frontend/src/components/PriceFeed.tsx`

**Panel Specs:**

**JobSubmit (top-left):**
- Fields: `model` (dropdown), `instance_type` (dropdown), `estimated_hours` (number), `deadline_window_hours` (number, 0=immediate)
- Submit button → `POST /submit-job`
- Shows selected user from UserSwitcher

**LiveLedger (top-right):**
- Scrolling feed, newest on top
- Each row: `[hash_truncated] [user] [$amount] [BATCH|SOLO|SUBLEASED badge] [timestamp]`
- Click hash → copy full hash to clipboard

**SavingsCounter (bottom-right):**
- Per user card: `Saved: $X.XX (XX%)`
- Renter card: `Earned: $X.XX`
- Animated: counts from previous value → new value over 400ms
- Uses Recharts for savings trend line (optional, polish)

**AgentActivityLog (bottom):**
- Scrolling log, newest on top
- Each line prefixed with coloured agent name: `[WATCHER]` blue, `[STRATEGIST]` yellow, `[EXECUTOR]` green
- Human-readable text from `AgentEvent.message`

**Definition of Done:**
- All 4 panels render without TypeScript errors
- SavingsCounter animation triggers on WS savings update
- LiveLedger auto-scrolls to newest receipt
- AgentActivityLog colours match spec

---

### 🔴 Agent I — Integration & Wiring
**Role:** Integration Engineer  
**Day:** 4–5  
**Depends On:** Agent E (Executor), Agent H (Frontend UI)  

**Deliverables:**
- End-to-end connected system
- Integration test script: `scripts/demo_run.py`

**Integration Checklist:**
- [ ] Frontend `useSocket` connects to `ws://localhost:8000/ws`
- [ ] `POST /submit-job` from `JobSubmit` form reaches backend and returns `job_id`
- [ ] Submitting 2 Batcher jobs triggers BATCH decision in Strategist
- [ ] AMD inference call fires (check backend logs)
- [ ] X402 receipt appears in `LiveLedger` within 1 second
- [ ] `SavingsCounter` updates with correct delta
- [ ] `AgentActivityLog` shows all 3 agent colours
- [ ] `POST /release-renter` tested: Renter instance reclaimed
- [ ] WebSocket disconnect + reconnect tested: UI recovers within 3 seconds
- [ ] Render throttle verified: no UI flicker on rapid events

**Demo Scenario Script (`scripts/demo_run.py`):**
```
T+0s   Submit Batcher A job (instance=MI300X, hours=0.5, deadline=2h)
T+5s   Submit Batcher B job (instance=MI300X, hours=0.5, deadline=2h)
T+10s  Strategist fires BATCH → both jobs grouped
T+15s  Executor fires AMD inference call
T+18s  X402 receipts appear for both Batchers
T+25s  Watcher detects Renter idle → SUBLEASED event
T+35s  Submit Solo job (instance=MI300X, hours=0.25, deadline=0)
T+40s  Strategist fires RUN_NOW
T+45s  Executor fires AMD inference call for Solo
T+50s  Solo receipt appears
T+60s  Renter kill-switch demonstrated
T+90s  END — all savings counters show non-zero values
```

**Definition of Done:**
- `scripts/demo_run.py` completes without error 5× in a row
- All panels update in real time (no manual refresh)
- Backend logs show: 2× AMD API calls (Batch + Solo), 3× X402 receipts

---

### ⚙️ Agent J — DevOps & Deploy
**Role:** DevOps Engineer  
**Day:** 7  
**Depends On:** Agent I (Integration)  

**Deliverables:**
- `README.md` — setup + run instructions + architecture overview
- `.env.example` — all keys with placeholder values
- Vercel deployment of frontend (`frontend/`)
- Backend hosting (Railway / Render / fly.io recommended)
- `scripts/record_demo.sh` — screen record helper
- Demo video backup (2 min, stored locally)

**README Sections:**
1. One-line pitch
2. Architecture diagram (text art OK)
3. Quick start (5 commands max)
4. Environment variables table
5. Demo script instructions
6. Team credits

**Definition of Done:**
- `https://<project>.vercel.app` loads the dashboard without errors
- Backend URL is set as `VITE_BACKEND_URL` in Vercel environment
- `README.md` has no TODO placeholders
- `.env` is in `.gitignore`
- Demo video is recorded and stored

---

### ✅ Agent K — Verifier & QA
**Role:** Quality Assurance / Demo Director  
**Day:** 6–7  
**Depends On:** Agent I (Integration)  

**Verification Test Suite:**

#### Test 1: Batch Matching (Critical)
```
Input:  Submit Batcher A + Batcher B with same instance_type, deadline > 0
Expect: Strategist emits BATCH decision
        Savings counter shows <100% of solo rate for both users
        1 AMD inference call (not 2) in backend logs
Pass:   All 3 conditions met on 3/3 runs
```

#### Test 2: X402 Receipt Latency (Critical)
```
Input:  Any job completion
Expect: SettlementReceipt appears in LiveLedger within 1000ms
Measure: timestamp_receipt - timestamp_executor_start < 1000ms
Pass:   Passes on 5/5 runs
```

#### Test 3: Savings Accuracy (Critical)
```
Input:  BATCH job at spot_price=$0.50/hr, est_hours=0.5, n_jobs=2
Expect: Each Batcher pays $0.125 (solo would be $0.25)
        Savings shown: $0.125 (50%)
        Delta from baseline: ±$0.01 max
Pass:   Arithmetic verified on 3/3 runs
```

#### Test 4: Real AMD API Call (Critical — Non-Negotiable)
```
Input:  Any job submission with AMD_API_KEY set
Expect: Backend log shows HTTP 200 from AMD_API_BASE
        Response contains model output (not mock placeholder)
Pass:   Confirmed in logs on 1 run minimum
```

#### Test 5: WebSocket Auto-Reconnect
```
Input:  Kill backend mid-session, restart within 5 seconds
Expect: Frontend reconnects automatically
        Agent log shows [RECONNECTED] or similar
        No page refresh required
Pass:   2/2 runs
```

#### Test 6: Renter Kill-Switch
```
Input:  POST /release-renter with active sub-lease
Expect: Renter instance freed within 1 second
        SUBLEASED_CREDIT payment sent before release
        Watcher stops broadcasting IDLE_DETECTED for that instance
Pass:   2/2 runs
```

#### Test 7: Full Demo Script (End-to-End)
```
Input:  Run scripts/demo_run.py
Expect: Completes within 90–100 seconds
        No manual intervention
        All 3 user archetypes interact
        All 4 dashboard panels show live data
Pass:   8/10 runs (allow 2 partial failures for timing variance)
```

#### Test 8: API Shape Validation
```
For each endpoint:
  GET  /jobs     → returns array, each item matches JobRequest schema
  GET  /ledger   → returns array, each item matches SettlementReceipt schema
  GET  /prices   → returns PriceTick + 2h history array
  GET  /savings  → returns SavedSummary[] with user_id, saved_usd, pct_saved
  POST /submit-job → returns { job_id: string }
  POST /release-renter → returns { success: true }
Pass:   All 6 endpoints pass schema validation
```

#### Test 9: Security Baseline
```
Verify: .env is listed in .gitignore
Verify: No wallet addresses hardcoded in source files
Verify: No AMD_API_KEY in any committed file
Pass:   git grep "AMD_API_KEY=" shows no results outside .env
```

#### Test 10: Frontend Deployment
```
Input:  Open Vercel URL in browser (Chrome + Firefox)
Expect: Dashboard loads within 3 seconds
        WebSocket connects to backend URL
        All 4 panels are visible
Pass:   Both browsers pass
```

---

## Orchestration Execution Order

```
DAY 1 ────────────────────────────────────────────────────────────────────
  ▶ Agent A (Backend Core)        │ parallel  ▶ Agent G (Frontend Core)
  ▶ Agent B (AMD Client)          │
  
DAY 2 ────────────────────────────────────────────────────────────────────
  ▶ Agent C (Watcher)             │ parallel  ▶ Agent H (Frontend UI)
  ▶ Agent D (Strategist)          │             [panels 1-3]
  ▶ Agent F (X402)                │

DAY 3 ────────────────────────────────────────────────────────────────────
  ▶ Agent E (Executor)            │ parallel  ▶ Agent H (Frontend UI)
                                  │             [panel 4 + polish]

DAY 4–5 ──────────────────────────────────────────────────────────────────
  ▶ Agent I (Integration)         │ both engineers together

DAY 6 ────────────────────────────────────────────────────────────────────
  ▶ Agent K (Verifier — first pass, fix issues)

DAY 7 ────────────────────────────────────────────────────────────────────
  ▶ Agent J (DevOps)              │ parallel  ▶ Agent K (Verifier — final)

DAY 8 ────────────────────────────────────────────────────────────────────
  ▶ Final demo at 9am → submit before noon
```

---

## Cross-Cutting Rules for All Agents

1. **No polling in frontend** — all real-time updates via WebSocket only
2. **Mock = real UX** — every mock fallback must produce identical UI output to the real path
3. **Secrets in `.env` only** — never hardcode API keys, wallet addresses, or tokens
4. **max_tokens=50** on all LLM calls — conserve AMD credits
5. **Pre-compute scripted paths** — deterministic Python makes decisions; LLM adds explanation text
6. **Hard timebox X402** — switch to mock at exactly 4 hours if real integration is unstable
7. **Never cut the 5 hard requirements** — savings counter, receipt feed, agent log, 3 archetypes, real AMD call

---

## File Structure (Expected at Integration Day)

```
FORGE/
├── backend/
│   ├── main.py              # FastAPI app + endpoints
│   ├── models.py            # Pydantic v2 dataclasses
│   ├── websocket_hub.py     # ConnectionManager
│   ├── amd_client.py        # AMD API + mock
│   ├── agents/
│   │   ├── watcher.py       # Watcher agent (blue)
│   │   ├── strategist.py    # Strategist agent (yellow)
│   │   └── executor.py      # Executor agent (green)
│   └── payments/
│       └── x402_client.py   # X402 real + mock
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   └── useSocket.ts
│   │   ├── types/
│   │   │   └── events.ts
│   │   └── components/
│   │       ├── UserSwitcher.tsx
│   │       ├── JobSubmit.tsx
│   │       ├── LiveLedger.tsx
│   │       ├── SavingsCounter.tsx
│   │       ├── AgentActivityLog.tsx
│   │       ├── BatchView.tsx
│   │       └── PriceFeed.tsx
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   ├── demo_run.py          # 90-second scripted demo
│   └── record_demo.sh       # screen capture helper
├── .env                     # NEVER commit
├── .env.example             # commit this
├── .gitignore
├── README.md
├── claude.md                # task progress log (this build)
└── .skill                   # agent skill knowledge base
```

---

*Generated from FORGE-PRD-Layer1.docx + FORGE-PRD-AllLayers.docx · Version 0.1 · May 2026*
