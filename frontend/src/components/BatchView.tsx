import type { ExecutionPlan } from "../types/events";

interface Props {
  plans: ExecutionPlan[];
}

export function BatchView({ plans }: Props) {
  if (plans.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
      {plans
        .slice(-3)
        .reverse()
        .map((plan) => (
          <div
            key={plan.plan_id}
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "8px",
              padding: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "11px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#f9fafb", fontWeight: 700 }}>
                {plan.instance_type} · {plan.job_ids.length} job{plan.job_ids.length === 1 ? "" : "s"}
              </span>
              <span
                style={{
                  color: plan.strategy === "BATCH" ? "#6366f1" : "#f59e0b",
                  background: plan.strategy === "BATCH" ? "#6366f122" : "#f59e0b22",
                  borderRadius: "999px",
                  padding: "2px 8px",
                  fontWeight: 700,
                }}
              >
                {plan.strategy}
              </span>
            </div>
            <div style={{ color: "#94a3b8" }}>Jobs: {plan.job_ids.join(", ")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#d1d5db" }}>
              <span>${plan.cost_per_job_usd.toFixed(4)} / job</span>
              <span>${plan.total_cost_usd.toFixed(4)} total</span>
            </div>
          </div>
        ))}
    </div>
  );
}
