import type { ExecutionPlan, SettlementReceipt, SubmittedJob } from "../types/events";
import type { UserId } from "./UserSwitcher";

interface Props {
  allJobs: SubmittedJob[];
  plans: ExecutionPlan[];
  receipts: SettlementReceipt[];
  activeUser: UserId;
}

const USER_COLOUR: Record<string, string> = {
  renter:    "var(--user-renter)",
  batcher_a: "var(--user-batcher-a)",
  batcher_b: "var(--user-batcher-b)",
  solo:      "var(--user-solo)",
};

const USER_LABEL: Record<string, string> = {
  renter:    "Renter",
  batcher_a: "Batcher A",
  batcher_b: "Batcher B",
  solo:      "Solo",
};

const INSTANCE_EMOJI: Record<string, string> = {
  MI300X: "🔥",
  MI250X: "⚡",
  MI100:  "💡",
};

export function LiveQueue({ allJobs, plans, receipts, activeUser }: Props) {
  const settledIds = new Set(receipts.map((r) => r.job_id));
  const pendingJobs = allJobs.filter((j) => !settledIds.has(j.job_id));

  const byInstance: Record<string, SubmittedJob[]> = {};
  for (const job of pendingJobs) {
    if (!byInstance[job.instance_type]) byInstance[job.instance_type] = [];
    byInstance[job.instance_type].push(job);
  }

  const plannedIds = new Set(plans.flatMap((p) => p.job_ids));

  if (pendingJobs.length === 0) {
    return (
      <div style={{
        color: "var(--text-muted)",
        fontSize: "11px",
        textAlign: "center",
        padding: "20px 0",
        fontFamily: "var(--font-mono)",
        fontStyle: "italic",
      }}>
        Queue is empty — submit a job to see it here
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {Object.entries(byInstance).map(([instanceType, jobs]) => {
        const pendingCount = jobs.filter((j) => !plannedIds.has(j.job_id)).length;
        const canBatch = pendingCount > 1;

        return (
          <div key={instanceType}>
            {/* Group header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "6px",
            }}>
              <span style={{ fontSize: "13px" }}>{INSTANCE_EMOJI[instanceType] ?? "💻"}</span>
              <span style={{
                fontSize: "12px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: "var(--text-secondary)",
                letterSpacing: "0.04em",
              }}>
                {instanceType}
              </span>
              <span style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
              }}>
                {jobs.length} job{jobs.length !== 1 ? "s" : ""}
              </span>
              {canBatch && (
                <span style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "var(--indigo)",
                  background: "var(--indigo-dim)",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  letterSpacing: "0.06em",
                  marginLeft: "2px",
                }}>
                  ⚡ BATCH-READY
                </span>
              )}
              {pendingCount === 1 && (
                <span style={{
                  fontSize: "9px",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  marginLeft: "2px",
                }}>
                  waiting for partner…
                </span>
              )}
            </div>

            {/* Job rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {jobs.map((job) => {
                const isMe = job.user_id === activeUser;
                const isPlanned = plannedIds.has(job.job_id);
                const isSettled = settledIds.has(job.job_id);
                const userCol = USER_COLOUR[job.user_id] ?? "var(--text-secondary)";

                // Find the plan this job belongs to, if any
                const plan = plans.find((p) => p.job_ids.includes(job.job_id));

                return (
                  <div
                    key={job.job_id}
                    className="animate-in"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "80px 80px 1fr auto auto",
                      alignItems: "center",
                      gap: "10px",
                      padding: "7px 12px",
                      background: isMe ? "rgba(99,102,241,0.06)" : "var(--bg-raised)",
                      border: "1px solid var(--border-dim)",
                      borderLeft: `3px solid ${isMe ? "var(--indigo)" : userCol}`,
                      borderRadius: "var(--radius-sm)",
                      opacity: isSettled ? 0.45 : 1,
                    }}
                  >
                    {/* Job ID */}
                    <span style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      fontWeight: isMe ? 700 : 500,
                      color: isMe ? "var(--text-primary)" : "var(--text-secondary)",
                    }}>
                      {job.job_id}
                      {isMe && <span style={{ color: "var(--indigo)", marginLeft: "3px" }}>★</span>}
                    </span>

                    {/* User badge */}
                    <span style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      color: userCol,
                      background: `color-mix(in srgb, ${userCol} 12%, transparent)`,
                      padding: "2px 6px",
                      borderRadius: "3px",
                      letterSpacing: "0.04em",
                      justifySelf: "start",
                    }}>
                      {USER_LABEL[job.user_id] ?? job.user_id}
                    </span>

                    {/* Model name */}
                    <span style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {job.model.split("/")[1]}
                    </span>

                    {/* Est hours */}
                    <span style={{
                      fontSize: "10px",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                    }}>
                      {job.estimated_hours}h · deadline {job.deadline_window_hours}h
                    </span>

                    {/* Status */}
                    {isPlanned && plan ? (
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "var(--amber)",
                        background: "rgba(245,158,11,0.12)",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        whiteSpace: "nowrap",
                      }}>
                        {plan.strategy}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        whiteSpace: "nowrap",
                      }}>
                        WAITING
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
