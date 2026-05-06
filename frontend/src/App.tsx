import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AgentActivityLog } from "./components/AgentActivityLog";
import { BatchView } from "./components/BatchView";
import { JobSubmit } from "./components/JobSubmit";
import { LiveLedger } from "./components/LiveLedger";
import { PriceFeed } from "./components/PriceFeed";
import { SavingsCounter } from "./components/SavingsCounter";
import { UserSwitcher, type UserId } from "./components/UserSwitcher";
import { useSocket } from "./hooks/useSocket";
import type { AgentEventData, ExecutionPlan, PriceTick, SavedSummary, SettlementReceipt } from "./types/events";

const THROTTLE_MS = 200;

type PendingUpdates = {
  receipts: SettlementReceipt[];
  agentEvents: AgentEventData[];
  priceTicks: PriceTick[];
  plans: ExecutionPlan[];
  savings?: SavedSummary[];
};

const emptyPendingUpdates = (): PendingUpdates => ({
  receipts: [],
  agentEvents: [],
  priceTicks: [],
  plans: [],
});

function App() {
  const { connected, lastEvent } = useSocket();
  const [activeUser, setActiveUser] = useState<UserId>("batcher_a");
  const [receipts, setReceipts] = useState<SettlementReceipt[]>([]);
  const [agentEvents, setAgentEvents] = useState<AgentEventData[]>([]);
  const [savings, setSavings] = useState<SavedSummary[]>([]);
  const [priceTicks, setPriceTicks] = useState<PriceTick[]>([]);
  const [plans, setPlans] = useState<ExecutionPlan[]>([]);

  const pendingRef = useRef<number | null>(null);
  const pendingUpdates = useRef<PendingUpdates>(emptyPendingUpdates());

  const flush = useCallback(() => {
    const updates = pendingUpdates.current;

    if (updates.receipts.length > 0) {
      setReceipts((current) => [...current, ...updates.receipts].slice(-200));
    }
    if (updates.agentEvents.length > 0) {
      setAgentEvents((current) => [...current, ...updates.agentEvents].slice(-200));
    }
    if (updates.priceTicks.length > 0) {
      setPriceTicks((current) => [...current, ...updates.priceTicks].slice(-100));
    }
    if (updates.plans.length > 0) {
      setPlans((current) => [...current, ...updates.plans].slice(-20));
    }
    if (updates.savings) {
      setSavings(updates.savings);
    }

    pendingUpdates.current = emptyPendingUpdates();
    pendingRef.current = null;
  }, []);

  const scheduleArrayUpdate = useCallback(
    <K extends "receipts" | "agentEvents" | "priceTicks" | "plans">(key: K, value: PendingUpdates[K]) => {
      pendingUpdates.current[key] = [...pendingUpdates.current[key], ...value] as PendingUpdates[K];
      if (pendingRef.current === null) {
        pendingRef.current = window.setTimeout(flush, THROTTLE_MS);
      }
    },
    [flush],
  );

  const scheduleSavingsUpdate = useCallback(
    (value: SavedSummary[]) => {
      pendingUpdates.current.savings = value;
      if (pendingRef.current === null) {
        pendingRef.current = window.setTimeout(flush, THROTTLE_MS);
      }
    },
    [flush],
  );

  useEffect(() => {
    if (!lastEvent) {
      return;
    }

    if (lastEvent.type === "RECEIPT") {
      scheduleArrayUpdate("receipts", [lastEvent.receipt]);
    }
    if (lastEvent.type === "AGENT") {
      scheduleArrayUpdate("agentEvents", [lastEvent.event]);
    }
    if (lastEvent.type === "SAVINGS") {
      scheduleSavingsUpdate(lastEvent.summary);
    }
    if (lastEvent.type === "PRICE") {
      scheduleArrayUpdate("priceTicks", [lastEvent.tick]);
    }
    if (lastEvent.type === "PLAN") {
      scheduleArrayUpdate("plans", [lastEvent.plan]);
    }
  }, [lastEvent, scheduleArrayUpdate, scheduleSavingsUpdate]);

  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) {
        window.clearTimeout(pendingRef.current);
      }
    };
  }, []);

  const panelStyle: CSSProperties = {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    overflow: "hidden",
  };

  const panelTitle = (icon: string, title: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span>{icon}</span>
      <span
        style={{
          color: "#6b7280",
          fontSize: "11px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {title}
      </span>
    </div>
  );

  return (
    <div
      style={{
        background: "#030712",
        minHeight: "100vh",
        padding: "16px",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ color: "#f9fafb", margin: 0, fontSize: "18px", fontWeight: 800 }}>⚡ FORGE</h1>
          <p style={{ color: "#4b5563", margin: 0, fontSize: "11px" }}>Autonomous Compute Exchange</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <PriceFeed ticks={priceTicks} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: connected ? "#22c55e" : "#ef4444",
                boxShadow: connected ? "0 0 6px #22c55e" : "none",
              }}
            />
            <span style={{ color: connected ? "#22c55e" : "#ef4444", fontSize: "11px", fontWeight: 700 }}>
              {connected ? "LIVE" : "RECONNECTING..."}
            </span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "12px" }}>
        <UserSwitcher current={activeUser} onChange={setActiveUser} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
        <div style={panelStyle}>
          {panelTitle("📤", "Submit Job")}
          <JobSubmit activeUser={activeUser} />
        </div>

        <div style={panelStyle}>
          {panelTitle("🧾", `Live Ledger (${receipts.length})`)}
          <BatchView plans={plans} />
          <LiveLedger receipts={receipts} />
        </div>

        <div style={panelStyle}>
          {panelTitle("💰", "Savings Counter")}
          <SavingsCounter summaries={savings} />
        </div>

        <div style={{ ...panelStyle, gridColumn: "1 / -1" }}>
          {panelTitle("🤖", `Agent Activity (${agentEvents.length})`)}
          <AgentActivityLog events={agentEvents} />
        </div>
      </div>
    </div>
  );
}

export default App;
