import { useCallback, useEffect, useRef, useState } from "react";
import { AgentActivityLog } from "./components/AgentActivityLog";
import { BatchView } from "./components/BatchView";
import { InstanceCatalog } from "./components/InstanceCatalog";
import { JobSubmit } from "./components/JobSubmit";
import { LiveLedger } from "./components/LiveLedger";
import { LiveQueue } from "./components/LiveQueue";
import { MyJobsTracker } from "./components/MyJobsTracker";
import { PriceFeed } from "./components/PriceFeed";
import { SavingsCounter } from "./components/SavingsCounter";
import { UserSwitcher, type UserId } from "./components/UserSwitcher";
import { useSocket } from "./hooks/useSocket";
import type { AgentEventData, ExecutionPlan, PriceTick, SavedSummary, SettlementReceipt, SubmittedJob } from "./types/events";
import "./index.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const THROTTLE_MS = 200;

type PendingUpdates = {
  receipts: SettlementReceipt[];
  agentEvents: AgentEventData[];
  priceTicks: PriceTick[];
  plans: ExecutionPlan[];
  savings?: SavedSummary[];
  allJobs: SubmittedJob[];
};

const emptyPendingUpdates = (): PendingUpdates => ({
  receipts: [],
  agentEvents: [],
  priceTicks: [],
  plans: [],
  allJobs: [],
});

function App() {
  const { connected, lastEvent } = useSocket();
  const [activeUser, setActiveUser] = useState<UserId>("batcher_a");
  const [receipts, setReceipts] = useState<SettlementReceipt[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEventData[]>([]);
  const [savings, setSavings] = useState<SavedSummary[]>([]);
  const [priceTicks, setPriceTicks] = useState<PriceTick[]>([]);
  const [plans, setPlans] = useState<ExecutionPlan[]>([]);
  const [allJobs, setAllJobs] = useState<SubmittedJob[]>([]);
  const [selectedInstance, setSelectedInstance] = useState("MI300X");

  const pendingRef = useRef<number | null>(null);
  const pendingUpdates = useRef<PendingUpdates>(emptyPendingUpdates());

  const flush = useCallback(() => {
    const updates = pendingUpdates.current;
    if (updates.receipts.length > 0) setReceipts((c) => [...c, ...updates.receipts].slice(-200));
    if (updates.agentEvents.length > 0) setAgentEvents((c) => [...c, ...updates.agentEvents].slice(-200));
    if (updates.priceTicks.length > 0) setPriceTicks((c) => [...c, ...updates.priceTicks].slice(-100));
    if (updates.plans.length > 0) setPlans((c) => [...c, ...updates.plans].slice(-20));
    if (updates.allJobs.length > 0) setAllJobs((c) => {
      const existingIds = new Set(c.map((j) => j.job_id));
      const fresh = updates.allJobs.filter((j) => !existingIds.has(j.job_id));
      return [...c, ...fresh].slice(-500);
    });
    if (updates.savings) setSavings(updates.savings);
    pendingUpdates.current = emptyPendingUpdates();
    pendingRef.current = null;
  }, []);

  const scheduleArrayUpdate = useCallback(
    <K extends "receipts" | "agentEvents" | "priceTicks" | "plans" | "allJobs">(key: K, value: PendingUpdates[K]) => {
      pendingUpdates.current[key] = [...pendingUpdates.current[key], ...value] as PendingUpdates[K];
      if (pendingRef.current === null) pendingRef.current = window.setTimeout(flush, THROTTLE_MS);
    },
    [flush],
  );

  const scheduleSavingsUpdate = useCallback(
    (value: SavedSummary[]) => {
      pendingUpdates.current.savings = value;
      if (pendingRef.current === null) pendingRef.current = window.setTimeout(flush, THROTTLE_MS);
    },
    [flush],
  );

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "RECEIPT") scheduleArrayUpdate("receipts", [lastEvent.receipt]);
    if (lastEvent.type === "AGENT") scheduleArrayUpdate("agentEvents", [lastEvent.event]);
    if (lastEvent.type === "SAVINGS") scheduleSavingsUpdate(lastEvent.summary);
    if (lastEvent.type === "PRICE") scheduleArrayUpdate("priceTicks", [lastEvent.tick]);
    if (lastEvent.type === "PLAN") scheduleArrayUpdate("plans", [lastEvent.plan]);
    if (lastEvent.type === "JOB_SUBMITTED") scheduleArrayUpdate("allJobs", [lastEvent.job]);
  }, [lastEvent, scheduleArrayUpdate, scheduleSavingsUpdate]);

  // Fetch existing jobs on mount (in case backend was already running with jobs)
  useEffect(() => {
    fetch(`${BACKEND}/jobs`)
      .then((r) => r.json())
      .then((jobs: SubmittedJob[]) => {
        if (Array.isArray(jobs) && jobs.length > 0) {
          setAllJobs(jobs);
        }
      })
      .catch(() => { /* backend not yet up — ignore */ });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current);
    };
  }, []);

  const myJobs = allJobs.filter((j) => j.user_id === activeUser);

  return (
    <div className="app-container">
      {/* ── Header ── */}
      <header className="flex-between" style={{ marginBottom: "24px", gap: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
            flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.2)",
          }}>⚡</div>
          <div>
            <h1 className="text-gradient" style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}>
              FORGE
            </h1>
            <p style={{
              color: "var(--text-muted)",
              margin: 0,
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}>
              Autonomous Compute Exchange
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <PriceFeed ticks={priceTicks} />
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg-raised)",
            border: "1px solid var(--border-dim)",
            borderRadius: "99px",
            padding: "6px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}>
            <div className={connected ? "status-dot status-dot--live" : "status-dot status-dot--dead"} />
            <span className="mono" style={{
              color: connected ? "var(--green)" : "var(--red)",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}>
              {connected ? "SYS_OK" : "SYS_ERR"}
            </span>
          </div>
        </div>
      </header>

      {/* ── User Context ── */}
      <div style={{ marginBottom: "20px" }}>
        <UserSwitcher current={activeUser} onChange={setActiveUser} />
      </div>

      {/* ── Instance Catalog ── */}
      <section className="panel" style={{ marginBottom: "20px" }}>
        <div className="panel-header">
          <span style={{ fontSize: "14px" }}>🖥️</span>
          <span className="panel-title-text">Compute Marketplace</span>
          <span className="badge" style={{ marginLeft: "auto", fontSize: "9px", color: "var(--green)", borderColor: "rgba(34,197,94,0.2)" }}>LIVE PRICING</span>
        </div>
        <InstanceCatalog
          ticks={priceTicks}
          selected={selectedInstance}
          onSelect={setSelectedInstance}
        />
      </section>

      {/* ── Main Engine Grid ── */}
      <main className="grid-layout">

        {/* Slot 1: Input + My Jobs */}
        <section className="panel">
          <div className="scanline" />
          <div className="panel-header">
            <span style={{ fontSize: "14px" }}>📤</span>
            <span className="panel-title-text">Compute Request</span>
          </div>
          <JobSubmit
            activeUser={activeUser}
            instanceType={selectedInstance}
            onInstanceTypeChange={setSelectedInstance}
          />
          <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: "14px" }}>
            <MyJobsTracker jobs={myJobs} plans={plans} receipts={receipts} />
          </div>
        </section>

        {/* Slot 2: Ledger */}
        <section className="panel">
          <div className="panel-header">
            <span style={{ fontSize: "14px" }}>🧾</span>
            <span className="panel-title-text">Real-time Settlement</span>
            <span className="badge" style={{ marginLeft: "auto", fontSize: "9px" }}>{receipts.length} TX</span>
          </div>
          <BatchView plans={plans} />
          <LiveLedger receipts={receipts} />
        </section>

        {/* Slot 3: Savings */}
        <section className="panel">
          <div className="panel-header">
            <span style={{ fontSize: "14px" }}>💰</span>
            <span className="panel-title-text">Optimization Metrics</span>
          </div>
          <SavingsCounter summaries={savings} />
        </section>

        {/* Slot 4: Strategy explainer */}
        <section className="panel">
          <div className="panel-header">
            <span style={{ fontSize: "14px" }}>📖</span>
            <span className="panel-title-text">Strategy Guide</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { strategy: "BATCH", color: "var(--strat-batch)", icon: "🔗", desc: "Two compatible jobs share one instance. Cost splits 50/50. Up to 50% savings vs solo rate." },
              { strategy: "RUN_NOW", color: "var(--strat-run-now)", icon: "🚀", desc: "Job executes immediately at full spot rate. No waiting. Best for urgent or deadline-sensitive work." },
              { strategy: "SUBLEASED", color: "var(--strat-subleased)", icon: "🏦", desc: "Job runs on a Renter's idle instance at a 15% discount. Renter earns 70% of the spot rate passively." },
              { strategy: "WAIT", color: "var(--text-secondary)", icon: "⏳", desc: "No match found yet. Strategist is holding for a compatible batch partner within the deadline window." },
            ].map(({ strategy, color, icon, desc }) => (
              <div key={strategy} style={{
                display: "flex",
                gap: "10px",
                padding: "8px 10px",
                background: "var(--bg-raised)",
                border: "1px solid var(--border-dim)",
                borderLeft: `3px solid ${color}`,
                borderRadius: "var(--radius-sm)",
              }}>
                <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color, fontFamily: "var(--font-mono)", marginBottom: "3px" }}>
                    {strategy}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ── Live Queue ── */}
      <section className="panel" style={{ marginTop: "20px" }}>
        <div className="panel-header">
          <span style={{ fontSize: "14px" }}>📋</span>
          <span className="panel-title-text">Live Job Queue</span>
          <span className="badge" style={{ marginLeft: "auto", fontSize: "9px" }}>
            {allJobs.filter((j) => !receipts.find((r) => r.job_id === j.job_id)).length} pending
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "6px" }}>
            ★ = your job
          </span>
        </div>
        <LiveQueue
          allJobs={allJobs}
          plans={plans}
          receipts={receipts}
          activeUser={activeUser}
        />
      </section>

      {/* ── Agent Log ── */}
      <section className="panel" style={{ marginTop: "20px" }}>
        <div className="panel-header">
          <span style={{ fontSize: "14px" }}>🤖</span>
          <span className="panel-title-text">Agent Intelligence Stream</span>
          <span className="badge" style={{ marginLeft: "auto", fontSize: "9px", color: "var(--amber)", borderColor: "rgba(245,158,11,0.2)" }}>ACTIVE</span>
        </div>
        <AgentActivityLog events={agentEvents} />
      </section>
    </div>
  );
}

export default App;
