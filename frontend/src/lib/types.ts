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
