export interface Task {
  id: number;
  name: string;
  description: string | null;
  routine: "morning" | "evening";
  carrot_value: number;
  estimated_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  assigned_child_ids: number[];
}

export interface Child {
  id: number;
  name: string;
  avatar: string;
  color: string;
  created_at: string;
}

export interface ChildCreate {
  name: string;
  avatar?: string;
  color?: string;
}

export interface ChildUpdate {
  name?: string;
  avatar?: string;
  color?: string;
}

export interface Completion {
  id: number;
  task_id: number;
  child_id: number | null;
  completion_date: string;
  completed_at: string;
}

export interface ToggleResult {
  action: "created" | "deleted";
  completion: Completion | null;
}

export interface RoutineSummary {
  total_carrots: number;
  earned_carrots: number;
  total_count: number;
  completed_count: number;
}

export interface DailySummary {
  date: string;
  morning: RoutineSummary;
  evening: RoutineSummary;
  total_carrots: number;
  earned_carrots: number;
}

export interface TaskCreate {
  name: string;
  description?: string;
  routine: "morning" | "evening";
  carrot_value: number;
  estimated_minutes?: number;
  sort_order?: number;
}

export interface TaskUpdate {
  name?: string;
  description?: string | null;
  routine?: "morning" | "evening";
  carrot_value?: number;
  estimated_minutes?: number | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface TaskAssignmentUpdate {
  child_ids: number[];
}

export interface DayCarrots {
  morning_earned_carrots: number;
  evening_earned_carrots: number;
  date: string;
  earned_carrots: number;
  total_carrots: number;
}

export interface TaskStat {
  task_id: number;
  name: string;
  routine: string;
  count: number;
}

export interface RangeSummary {
  start_date: string;
  end_date: string;
  days: DayCarrots[];
  task_stats: TaskStat[];
}

export interface ChildBalance {
  child_id: number;
  current_balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  dollar_value: number;
}

export interface Reward {
  id: number;
  name: string;
  carrot_cost: number;
  is_active: boolean;
  created_at: string;
}

export interface RewardCreate {
  name: string;
  carrot_cost: number;
  is_active?: boolean;
}

export interface RewardUpdate {
  name?: string;
  carrot_cost?: number;
  is_active?: boolean;
}

export type RedemptionStatus = "pending" | "approved" | "denied";

export interface RedemptionRequest {
  id: number;
  child_id: number;
  reward_id: number | null;
  reward_name: string;
  carrot_cost: number;
  status: RedemptionStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface Goal {
  id: number;
  child_id: number;
  name: string;
  target_dollars: number;
  earned_dollars: number;
  progress_percent: number;
  created_at: string;
  completed_at: string | null;
}

export interface GoalCreate {
  child_id: number;
  name: string;
  target_dollars: number;
}

export interface GoalUpdate {
  name?: string;
  target_dollars?: number;
}
