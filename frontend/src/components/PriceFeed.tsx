import type { PriceTick } from "../types/events";

interface Props {
  ticks: PriceTick[];
}

export function PriceFeed({ ticks }: Props) {
  const latest: Record<string, PriceTick> = {};
  ticks.forEach((tick) => {
    latest[tick.instance_type] = tick;
  });

  const trendIcon = (trend: string) => (trend === "UP" ? "↑" : trend === "DOWN" ? "↓" : "→");
  const trendColour = (trend: string) => (trend === "UP" ? "#ef4444" : trend === "DOWN" ? "#22c55e" : "#9ca3af");

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {Object.values(latest).map((tick) => (
        <div
          key={tick.instance_type}
          style={{
            background: "#1f2937",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "11px",
          }}
        >
          <span style={{ color: "#9ca3af" }}>{tick.instance_type} </span>
          <span style={{ color: "#f9fafb", fontWeight: 700 }}>${tick.spot_price_usd.toFixed(4)}</span>
          <span style={{ color: trendColour(tick.trend), marginLeft: "4px" }}>{trendIcon(tick.trend)}</span>
        </div>
      ))}
    </div>
  );
}
