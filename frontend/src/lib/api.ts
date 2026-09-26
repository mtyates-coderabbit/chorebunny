import type { Completion, DailySummary, RangeSummary, Task, TaskCreate, TaskUpdate, ToggleResult } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const _apiKey = process.env.NEXT_PUBLIC_API_KEY;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(_apiKey && { "X-Api-Key": _apiKey }),
    },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function fetchTasks(routine?: string, activeOnly = true): Promise<Task[]> {
  const params = new URLSearchParams();
  if (routine) params.set("routine", routine);
  params.set("active_only", String(activeOnly));
  return req(`/api/tasks?${params}`);
}

export function createTask(data: TaskCreate): Promise<Task> {
  return req("/api/tasks", { method: "POST", body: JSON.stringify(data) });
}

export function updateTask(id: number, data: TaskUpdate): Promise<Task> {
  return req(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteTask(id: number): Promise<void> {
  return req(`/api/tasks/${id}`, { method: "DELETE" });
}

export function fetchCompletions(date: string, routine?: string): Promise<Completion[]> {
  const params = new URLSearchParams({ date });
  if (routine) params.set("routine", routine);
  return req(`/api/completions?${params}`);
}

export function toggleCompletion(task_id: number, completion_date: string): Promise<ToggleResult> {
  return req("/api/completions/toggle", {
    method: "POST",
    body: JSON.stringify({ task_id, completion_date }),
  });
}

export function fetchSummary(date: string): Promise<DailySummary> {
  return req(`/api/summary?date=${date}`);
}

/**
 * Fetch daily carrot totals for inclusive YYYY-MM-DD bounds (at most 366 days).
 * Rejects reversed ranges and HTTP errors with status and response text, and
 * propagates network, response-reading, and JSON parsing failures.
 */
export function fetchRangeSummary(startDate: string, endDate: string): Promise<RangeSummary> {
  return req(`/api/summary/range?start_date=${startDate}&end_date=${endDate}`);
}
