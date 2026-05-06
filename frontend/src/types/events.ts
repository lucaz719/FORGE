export interface SettlementReceipt {
  receipt_hash: string;
  user_id: string;
  amount_usd: number;
  strategy: "BATCH" | "SOLO" | "SUBLEASED";
  timestamp: string;
  job_id: string;
}

export interface PriceTick {
  instance_type: string;
  spot_price_usd: number;
  timestamp: string;
  trend: "UP" | "DOWN" | "FLAT";
}

export interface AgentEventData {
  agent: "watcher" | "strategist" | "executor";
  message: string;
  colour: string;
  timestamp: string;
}

export interface SavedSummary {
  user_id: string;
  saved_usd: number;
  pct_saved: number;
  renter_earned_usd: number;
}

export interface ExecutionPlan {
  plan_id: string;
  job_ids: string[];
  strategy: string;
  instance_type: string;
  cost_per_job_usd: number;
  total_cost_usd: number;
  spot_price_usd: number;
}

export interface SubmittedJob {
  job_id: string;
  user_id: string;
  model: string;
  instance_type: string;
  estimated_hours: number;
  deadline_window_hours: number;
}

export type ForgeEvent =
  | { type: "AGENT"; event: AgentEventData }
  | { type: "RECEIPT"; receipt: SettlementReceipt }
  | { type: "PRICE"; tick: PriceTick }
  | { type: "SAVINGS"; summary: SavedSummary[] }
  | { type: "PLAN"; plan: ExecutionPlan }
  | { type: "JOB_SUBMITTED"; job: SubmittedJob }
  | { type: "RENTER_RELEASED"; timestamp: string };
