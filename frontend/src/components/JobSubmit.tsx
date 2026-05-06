import { useState, type CSSProperties, type FormEvent } from "react";
import type { UserId } from "./UserSwitcher";

const MODELS = [
  "meta-llama/Llama-3.1-8B-Instruct",
  "meta-llama/Llama-3.1-70B-Instruct",
  "mistralai/Mistral-7B-Instruct-v0.2",
];
const INSTANCE_TYPES = ["MI300X", "MI250X", "MI100"];
const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface Props {
  activeUser: UserId;
}

export function JobSubmit({ activeUser }: Props) {
  const [model, setModel] = useState(MODELS[0]);
  const [instanceType, setInstanceType] = useState(INSTANCE_TYPES[0]);
  const [estimatedHours, setEstimatedHours] = useState("0.5");
  const [deadlineWindow, setDeadlineWindow] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

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

  const inputStyle: CSSProperties = {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "6px",
    color: "#f9fafb",
    padding: "6px 10px",
    fontSize: "12px",
    width: "100%",
  };
  const labelStyle: CSSProperties = {
    color: "#9ca3af",
    fontSize: "11px",
    marginBottom: "3px",
    display: "block",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div>
        <label style={labelStyle}>Model</label>
        <select style={inputStyle} value={model} onChange={(event) => setModel(event.target.value)}>
          {MODELS.map((entry) => (
            <option key={entry} value={entry}>
              {entry.split("/")[1]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Instance Type</label>
        <select style={inputStyle} value={instanceType} onChange={(event) => setInstanceType(event.target.value)}>
          {INSTANCE_TYPES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div>
          <label style={labelStyle}>Est. Hours</label>
          <input
            style={inputStyle}
            type="number"
            step="0.1"
            min="0.1"
            value={estimatedHours}
            onChange={(event) => setEstimatedHours(event.target.value)}
          />
        </div>
        <div>
          <label style={labelStyle}>Deadline Window (hrs, 0=now)</label>
          <input
            style={inputStyle}
            type="number"
            step="0.5"
            min="0"
            value={deadlineWindow}
            onChange={(event) => setDeadlineWindow(event.target.value)}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        style={{
          background: submitting ? "#374151" : "#6366f1",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          padding: "8px",
          fontSize: "13px",
          fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Submitting..." : `⚡ Submit as ${activeUser.replace("_", " ").toUpperCase()}`}
      </button>
      {lastJobId && <div style={{ color: "#22c55e", fontSize: "11px" }}>✓ Job submitted: {lastJobId}</div>}
    </form>
  );
}
