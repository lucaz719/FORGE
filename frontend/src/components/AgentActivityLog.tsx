import { useEffect, useRef } from "react";
import type { AgentEventData } from "../types/events";

const AGENT_COLOURS: Record<string, string> = {
  watcher: "#3b82f6",
  strategist: "#eab308",
  executor: "#22c55e",
};
const AGENT_LABELS: Record<string, string> = {
  watcher: "WATCHER",
  strategist: "STRATEGIST",
  executor: "EXECUTOR",
};

interface Props {
  events: AgentEventData[];
}

export function AgentActivityLog({ events }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  return (
    <div style={{ overflowY: "auto", maxHeight: "180px", display: "flex", flexDirection: "column", gap: "4px" }}>
      {events.length === 0 && <p style={{ color: "#4b5563", fontSize: "12px" }}>Waiting for agent activity...</p>}
      {events.map((event, index) => {
        const colour = AGENT_COLOURS[event.agent] ?? "#9ca3af";
        const label = AGENT_LABELS[event.agent] ?? event.agent.toUpperCase();

        return (
          <div key={`${event.agent}-${event.timestamp}-${index}`} style={{ fontSize: "11px", display: "flex", gap: "8px", lineHeight: "1.5" }}>
            <span
              style={{
                color: colour,
                fontWeight: 700,
                whiteSpace: "nowrap",
                minWidth: "80px",
                fontFamily: "monospace",
              }}
            >
              [{label}]
            </span>
            <span style={{ color: "#d1d5db" }}>{event.message}</span>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
