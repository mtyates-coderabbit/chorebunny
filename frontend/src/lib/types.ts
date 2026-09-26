export interface Task {
  id: number;
  name: string;
  description: string | null;
  routine: "morning" | "evening";
  carrot_value: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Completion {
  id: number;
  task_id: number;
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
  sort_order?: number;
}

export interface TaskUpdate {
  name?: string;
  description?: string;
  routine?: "morning" | "evening";
  carrot_value?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface DayCarrots {
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
