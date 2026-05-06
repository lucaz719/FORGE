import { useEffect, useRef } from "react";
import type { SettlementReceipt } from "../types/events";

const STRATEGY_COLOURS: Record<string, string> = {
  BATCH: "#6366f1",
  SOLO: "#f59e0b",
  SUBLEASED: "#8b5cf6",
  RUN_NOW: "#f59e0b",
};

interface Props {
  receipts: SettlementReceipt[];
}

export function LiveLedger({ receipts }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [receipts.length]);

  const copyHash = (hash: string) => {
    void navigator.clipboard.writeText(hash).catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto", maxHeight: "240px" }}>
      {receipts.length === 0 && <p style={{ color: "#4b5563", fontSize: "12px" }}>Waiting for settlements...</p>}
      {receipts.map((receipt, index) => (
        <div
          key={`${receipt.receipt_hash}-${index}`}
          style={{
            background: "#1f2937",
            borderRadius: "6px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            fontSize: "11px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#9ca3af" }}>{receipt.user_id.replace("_", " ")}</span>
            <span
              style={{
                background: `${STRATEGY_COLOURS[receipt.strategy] ?? "#9ca3af"}33`,
                color: STRATEGY_COLOURS[receipt.strategy] ?? "#9ca3af",
                borderRadius: "4px",
                padding: "1px 6px",
                fontWeight: 700,
                fontSize: "10px",
              }}
            >
              {receipt.strategy}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <button
              onClick={() => copyHash(receipt.receipt_hash)}
              style={{
                background: "none",
                border: "none",
                color: "#6366f1",
                cursor: "pointer",
                fontSize: "11px",
                fontFamily: "monospace",
                padding: 0,
                textAlign: "left",
              }}
              title="Click to copy"
              type="button"
            >
              {receipt.receipt_hash.slice(0, 18)}...
            </button>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>${receipt.amount_usd.toFixed(4)}</span>
          </div>
          <div style={{ color: "#4b5563", fontSize: "10px" }}>{new Date(receipt.timestamp).toLocaleTimeString()}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
