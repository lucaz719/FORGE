import type { PriceTick } from "../types/events";

interface InstanceSpec {
  id: string;
  gpu: string;
  vram: string;
  vcpu: string;
  tagline: string;
  emoji: string;
  color: string;
  colorRgb: string;
}

const SPECS: InstanceSpec[] = [
  {
    id: "MI300X",
    gpu: "8× MI300X GPU",
    vram: "192 GB HBM3",
    vcpu: "160 vCPU · 384 GB RAM",
    tagline: "Flagship multi-GPU · 70B LLM training & inference",
    emoji: "🔥",
    color: "#6366f1",
    colorRgb: "99, 102, 241",
  },
  {
    id: "MI250X",
    gpu: "1× MI250X GPU",
    vram: "192 GB HBM2e",
    vcpu: "96 vCPU · 192 GB RAM",
    tagline: "High memory · Large-batch 7B–13B inference",
    emoji: "⚡",
    color: "#06b6d4",
    colorRgb: "6, 182, 212",
  },
  {
    id: "MI100",
    gpu: "1× MI100 GPU",
    vram: "32 GB HBM2",
    vcpu: "64 vCPU · 128 GB RAM",
    tagline: "Cost-efficient · Small model inference & dev",
    emoji: "💡",
    color: "#22c55e",
    colorRgb: "34, 197, 94",
  },
];

interface Props {
  ticks: PriceTick[];
  selected: string;
  onSelect: (instanceType: string) => void;
}

export function InstanceCatalog({ ticks, selected, onSelect }: Props) {
  const latestPrices = ticks.reduce<Record<string, PriceTick>>((acc, t) => {
    if (!acc[t.instance_type] || t.timestamp > acc[t.instance_type].timestamp) {
      acc[t.instance_type] = t;
    }
    return acc;
  }, {});

  return (
    <div>
      <div style={{
        color: "var(--text-muted)",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: "10px",
      }}>
        Available Compute — AMD Dev Cloud · Click to select
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {SPECS.map((spec) => {
          const tick = latestPrices[spec.id];
          const isSelected = selected === spec.id;
          return (
            <button
              key={spec.id}
              onClick={() => onSelect(spec.id)}
              style={{
                background: isSelected
                  ? `rgba(${spec.colorRgb}, 0.10)`
                  : "var(--bg-raised)",
                border: isSelected
                  ? `1px solid rgba(${spec.colorRgb}, 0.45)`
                  : "1px solid var(--border-dim)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 200ms var(--ease)",
                display: "flex",
                flexDirection: "column",
                gap: "5px",
                boxShadow: isSelected ? `0 0 16px rgba(${spec.colorRgb}, 0.15)` : "none",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "16px" }}>{spec.emoji}</span>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: spec.color,
                  background: `rgba(${spec.colorRgb}, 0.12)`,
                  padding: "2px 7px",
                  borderRadius: "4px",
                  letterSpacing: "0.04em",
                }}>
                  {spec.id}
                </span>
              </div>

              <div style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600, marginTop: "2px" }}>
                {spec.gpu}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                {spec.vram}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {spec.vcpu}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", lineHeight: 1.5, marginTop: "2px" }}>
                {spec.tagline}
              </div>

              <div style={{
                marginTop: "6px",
                paddingTop: "8px",
                borderTop: "1px solid var(--border-dim)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Spot Rate
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {tick ? `$${tick.spot_price_usd.toFixed(3)}/hr` : "—"}
                  {tick?.trend === "UP" && <span style={{ color: "var(--red)", marginLeft: "4px", fontSize: "10px" }}>↑</span>}
                  {tick?.trend === "DOWN" && <span style={{ color: "var(--green)", marginLeft: "4px", fontSize: "10px" }}>↓</span>}
                </span>
              </div>

              {isSelected && (
                <div style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: spec.color,
                  textAlign: "center",
                  marginTop: "2px",
                  letterSpacing: "0.08em",
                }}>
                  ✓ SELECTED
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
