import type { ExecutionPlan, SettlementReceipt, SubmittedJob } from "../types/events";

interface Props {
  jobs: SubmittedJob[];
  plans: ExecutionPlan[];
  receipts: SettlementReceipt[];
}

type JobStatus = "QUEUED" | "IN_PLAN" | "SETTLED";

interface TrackedJob extends SubmittedJob {
  status: JobStatus;
  plan?: ExecutionPlan;
  receipt?: SettlementReceipt;
}

const STATUS_COLOUR: Record<JobStatus, string> = {
  QUEUED:  "var(--text-secondary)",
  IN_PLAN: "var(--amber)",
  SETTLED: "var(--green)",
};

const STATUS_BG: Record<JobStatus, string> = {
  QUEUED:  "rgba(148,163,184,0.08)",
  IN_PLAN: "rgba(245,158,11,0.12)",
  SETTLED: "rgba(34,197,94,0.12)",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  QUEUED:  "⏳ QUEUED",
  IN_PLAN: "🔄 IN PLAN",
  SETTLED: "✓ SETTLED",
};

const STRATEGY_COLOUR: Record<string, string> = {
  BATCH:     "var(--strat-batch)",
  RUN_NOW:   "var(--strat-run-now)",
  SUBLEASED: "var(--strat-subleased)",
  WAIT:      "var(--text-secondary)",
};

export function MyJobsTracker({ jobs, plans, receipts }: Props) {
  if (jobs.length === 0) {
    return (
      <div style={{
        color: "var(--text-muted)",
        fontSize: "11px",
        textAlign: "center",
        padding: "14px 0",
        fontFamily: "var(--font-mono)",
        fontStyle: "italic",
      }}>
        No jobs submitted yet
      </div>
    );
  }

  const tracked: TrackedJob[] = jobs.map((job) => {
    const receipt = receipts.find((r) => r.job_id === job.job_id);
    if (receipt) return { ...job, status: "SETTLED", receipt };

    const plan = plans.find((p) => p.job_ids.includes(job.job_id));
    if (plan) return { ...job, status: "IN_PLAN", plan };

    return { ...job, status: "QUEUED" };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{
        color: "var(--text-muted)",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.10em",
        marginBottom: "2px",
      }}>
        My Jobs ({jobs.length})
      </div>
      {tracked.slice(-6).reverse().map((job) => {
        const col = STATUS_COLOUR[job.status];
        const bg  = STATUS_BG[job.status];

        const batchPartners = job.plan
          ? job.plan.job_ids.filter((id) => id !== job.job_id)
          : [];

        return (
          <div
            key={job.job_id}
            className="animate-in"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--border-dim)",
              borderLeft: `3px solid ${col}`,
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}>
                {job.job_id}
              </span>
              <span style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: col,
                background: bg,
                padding: "2px 7px",
                borderRadius: "4px",
              }}>
                {STATUS_LABEL[job.status]}
              </span>
            </div>

            {/* Specs row */}
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {job.instance_type}
              <span style={{ color: "var(--text-muted)" }}> · </span>
              {job.model.split("/")[1]}
              <span style={{ color: "var(--text-muted)" }}> · {job.estimated_hours}h</span>
            </div>

            {/* IN_PLAN: show strategy + batch partners */}
            {job.status === "IN_PLAN" && job.plan && (
              <div style={{ fontSize: "10px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  color: STRATEGY_COLOUR[job.plan.strategy] ?? "var(--text-secondary)",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                }}>
                  {job.plan.strategy}
                </span>
                {batchPartners.length > 0 && (
                  <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                    batched with{" "}
                    {batchPartners.map((id) => (
                      <span
                        key={id}
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-secondary)",
                          background: "var(--bg-raised)",
                          border: "1px solid var(--border-dim)",
                          padding: "0 4px",
                          borderRadius: "3px",
                          marginLeft: "3px",
                        }}
                      >
                        {id}
                      </span>
                    ))}
                  </span>
                )}
                <span style={{ color: "var(--text-muted)", fontSize: "10px", marginLeft: "auto" }}>
                  ${job.plan.cost_per_job_usd.toFixed(4)}/job
                </span>
              </div>
            )}

            {/* SETTLED: show amount + strategy */}
            {job.status === "SETTLED" && job.receipt && (
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--green)", display: "flex", justifyContent: "space-between" }}>
                <span>Paid <strong>${job.receipt.amount_usd.toFixed(4)}</strong></span>
                <span style={{
                  color: STRATEGY_COLOUR[job.receipt.strategy] ?? "var(--text-secondary)",
                  fontWeight: 700,
                }}>
                  {job.receipt.strategy}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
