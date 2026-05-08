import { useState, type FormEvent } from "react";
import type { UserId } from "./UserSwitcher";

const MODELS = [
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.1-70B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.2",
];
const INSTANCE_TYPES = ["MI300X", "MI250X", "MI100"];
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

const EXPLAINER: Record<string, { headline: string; body: string; tip: string; color: string }> = {
  batcher_a: {
    headline: "⚡ Batch Compute Mode",
    body: "Your job waits for a compatible batch partner (same GPU type, overlapping deadline). Once matched, the instance cost splits equally — you pay up to 50% less than solo rate.",
    tip: "🔑 Results: Your settlement receipt appears in the ledger once the Executor completes the batch. Your job ID will be listed under 'My Jobs' below.",
    color: "var(--user-batcher-a)",
  },
  batcher_b: {
    headline: "⚡ Batch Compute Mode",
    body: "Your job waits for a compatible batch partner (same GPU type, overlapping deadline). Once matched, the instance cost splits equally — you pay up to 50% less than solo rate.",
    tip: "🔑 Results: Your settlement receipt appears in the ledger once the Executor completes the batch. Your job ID will be listed under 'My Jobs' below.",
    color: "var(--user-batcher-b)",
  },
  solo: {
    headline: "🚀 Solo Compute Mode",
    body: "Your job runs immediately at the current spot rate — no waiting, no sharing. The Strategist issues a RUN_NOW plan and the Executor fires within seconds.",
    tip: "💡 Tip: If your deadline is flexible, switch to Batcher A or B to split the instance cost by up to 50%.",
    color: "var(--user-solo)",
  },
  renter: {
    headline: "🏦 Sublease Income Mode",
    body: "You own an idle AMD GPU instance. When FORGE detects it's unused for >15 min, it sub-leases it to incoming jobs. You earn 70% of each payment — fully automated.",
    tip: "📊 Earnings: Track income in Optimization Metrics → Renter Earned. Release your instance anytime with the Kill Switch button.",
    color: "var(--user-renter)",
  },
};

interface Props {
  activeUser: UserId;
  instanceType: string;
  onInstanceTypeChange: (v: string) => void;
}

export function JobSubmit({ activeUser, instanceType, onInstanceTypeChange }: Props) {
  const [model, setModel] = useState(MODELS[0]);
  const [estimatedHours, setEstimatedHours] = useState("0.5");
  const [deadlineWindow, setDeadlineWindow] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(true);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setLastJobId(null);
    try {
      const response = await fetch(`${BACKEND}/submit-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: activeUser,
          model,
          instance_type: instanceType,
          estimated_hours: parseFloat(estimatedHours),
          deadline_window_hours: parseFloat(deadlineWindow),
        }),
      });
      const data = (await response.json()) as { job_id?: string };
      setLastJobId(data.job_id ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const USER_LABELS: Record<string, string> = {
    renter: "Renter",
    batcher_a: "Batcher A",
    batcher_b: "Batcher B",
    solo: "Solo",
  };

  const exp = EXPLAINER[activeUser];

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* Role explainer banner */}
      {exp && (
        <div style={{
          background: `color-mix(in srgb, ${exp.color} 8%, transparent)`,
          border: `1px solid color-mix(in srgb, ${exp.color} 25%, transparent)`,
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}>
          <button
            type="button"
            onClick={() => setExplainerOpen((o) => !o)}
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: exp.color,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.04em",
              gap: "8px",
            }}
          >
            <span>{exp.headline}</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)", flexShrink: 0 }}>
              {explainerOpen ? "▴ hide" : "▾ show"}
            </span>
          </button>
          {explainerOpen && (
            <div style={{ padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                {exp.body}
              </p>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                {exp.tip}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Model</label>
        <select
          className="form-select mono"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {MODELS.map((entry) => (
            <option key={entry} value={entry}>
              {entry.split("/")[1]}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Instance Type</label>
        <select
          className="form-select mono"
          value={instanceType}
          onChange={(e) => onInstanceTypeChange(e.target.value)}
        >
          {INSTANCE_TYPES.map((entry) => (
            <option key={entry} value={entry}>{entry}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div className="form-group">
          <label className="form-label">Est. Hours</label>
          <input
            className="form-input mono"
            type="number"
            step="0.1"
            min="0.1"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Deadline (hrs)</label>
          <input
            className="form-input mono"
            type="number"
            step="0.5"
            min="0"
            value={deadlineWindow}
            onChange={(e) => setDeadlineWindow(e.target.value)}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary"
        style={{ width: "100%", marginTop: "2px" }}
      >
        {submitting ? (
          <>
            <span style={{ animation: "pulse 1s ease-in-out infinite" }}>⏳</span>
            Submitting...
          </>
        ) : (
          <>
            ⚡ Submit as {USER_LABELS[activeUser] ?? activeUser}
          </>
        )}
      </button>

      {lastJobId && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          background: "var(--green-dim)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "var(--radius-sm)",
          padding: "8px 10px",
          animation: "slideIn var(--slow) var(--ease) both",
        }}>
          <span style={{ color: "var(--green)", fontSize: "12px" }}>✓</span>
          <span style={{ color: "var(--green)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            Job submitted: {lastJobId}
          </span>
        </div>
      )}
    </form>
  );
}
