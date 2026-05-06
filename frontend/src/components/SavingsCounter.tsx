import { useEffect, useRef, useState } from "react";
import type { SavedSummary } from "../types/events";

const USER_COLOURS: Record<string, string> = {
  renter: "#8b5cf6",
  batcher_a: "#3b82f6",
  batcher_b: "#06b6d4",
  solo: "#f59e0b",
};

function AnimatedNumber({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(display);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const DURATION = 400;

  useEffect(() => {
    const from = startRef.current;
    const to = value;

    if (from === to) {
      return;
    }

    startTimeRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const step = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }
      const progress = Math.min((timestamp - startTimeRef.current) / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        startRef.current = to;
        setDisplay(to);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value]);

  return (
    <span>
      {prefix}
      {display.toFixed(4)}
    </span>
  );
}

interface Props {
  summaries: SavedSummary[];
}

export function SavingsCounter({ summaries }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {summaries.length === 0 && <p style={{ color: "#4b5563", fontSize: "12px" }}>Waiting for job settlements...</p>}
      {summaries.map((summary) => {
        const colour = USER_COLOURS[summary.user_id] ?? "#9ca3af";
        const isRenter = summary.user_id === "renter";

        return (
          <div
            key={summary.user_id}
            style={{
              background: "#1f2937",
              borderRadius: "8px",
              padding: "10px 12px",
              borderLeft: `3px solid ${colour}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <span style={{ color: colour, fontWeight: 700, fontSize: "12px" }}>
                {summary.user_id.replace("_", " ").toUpperCase()}
              </span>
              {isRenter ? (
                <span style={{ color: "#22c55e", fontSize: "13px", fontWeight: 800 }}>
                  +<AnimatedNumber value={summary.renter_earned_usd} /> earned
                </span>
              ) : (
                <span style={{ color: "#22c55e", fontSize: "13px", fontWeight: 800 }}>
                  <AnimatedNumber value={summary.saved_usd} /> saved
                </span>
              )}
            </div>
            {!isRenter && summary.pct_saved > 0 && (
              <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>
                {summary.pct_saved.toFixed(1)}% vs pay-as-you-go
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
