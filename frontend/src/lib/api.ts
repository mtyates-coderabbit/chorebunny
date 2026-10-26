import type { Child, ChildBalance, ChildCreate, ChildUpdate, Completion, DailySummary, RangeSummary, RedemptionRequest, RedemptionStatus, Reward, RewardCreate, RewardUpdate, Task, TaskAssignmentUpdate, TaskCreate, TaskUpdate, ToggleResult } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function fetchTasks(routine?: string, activeOnly = true, childId?: number): Promise<Task[]> {
  const params = new URLSearchParams();
  if (routine) params.set("routine", routine);
  params.set("active_only", String(activeOnly));
  if (childId !== undefined) params.set("child_id", String(childId));
  return req(`/api/tasks?${params}`);
}

/** Replace the per-child assignment list for a task; empty array restores global visibility. */
export function setTaskAssignments(id: number, data: TaskAssignmentUpdate): Promise<Task> {
  return req(`/api/tasks/${id}/assignments`, { method: "PUT", body: JSON.stringify(data) });
}

export function createTask(data: TaskCreate): Promise<Task> {
  return req("/api/tasks", { method: "POST", body: JSON.stringify(data) });
}

export function updateTask(id: number, data: TaskUpdate): Promise<Task> {
  return req(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

/** Move a task one position within its routine atomically. */
export function reorderTask(id: number, direction: -1 | 1): Promise<void> {
  return req(`/api/tasks/${id}/reorder`, { method: "POST", body: JSON.stringify({ direction }) });
}

export function deleteTask(id: number): Promise<void> {
  return req(`/api/tasks/${id}`, { method: "DELETE" });
}

/** Return all child profiles in creation order. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function fetchChildren(): Promise<Child[]> {
  return req("/api/children");
}

/** Persist and return a child profile; omitted avatar and color use API defaults. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function createChild(data: ChildCreate): Promise<Child> {
  return req("/api/children", { method: "POST", body: JSON.stringify(data) });
}

/** Persist supplied profile fields and return the child, preserving omitted fields; a missing child rejects with HTTP 404. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function updateChild(id: number, data: ChildUpdate): Promise<Child> {
  return req(`/api/children/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

/** Delete a child and their completions, resolving to undefined on HTTP 204; a missing child rejects with HTTP 404. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function deleteChild(id: number): Promise<void> {
  return req(`/api/children/${id}`, { method: "DELETE" });
}

/** Return a child's carrot balance and its dollar equivalent at the configured conversion rate; a missing child rejects with HTTP 404. */
export function fetchBalance(childId: number): Promise<ChildBalance> {
  return req(`/api/children/${childId}/balance`);
}

/** Return completions of active tasks for a YYYY-MM-DD date, optionally filtered by nonempty routine; omitted childId selects only completions with no child. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function fetchCompletions(date: string, routine?: string, childId?: number): Promise<Completion[]> {
  const params = new URLSearchParams({ date });
  if (routine) params.set("routine", routine);
  if (childId !== undefined) params.set("child_id", String(childId));
  return req(`/api/completions?${params}`);
}

/** Toggle a task for a YYYY-MM-DD date and optional child (omitted means no child); return created with a new or concurrently inserted completion, or deleted with null; a missing child rejects with HTTP 404. Rejects HTTP errors with status and response text; propagates network, response-reading, and JSON parsing failures. */
export function toggleCompletion(task_id: number, completion_date: string, child_id?: number): Promise<ToggleResult> {
  return req("/api/completions/toggle", {
    method: "POST",
    body: JSON.stringify({ task_id, completion_date, child_id: child_id ?? null }),
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
export function fetchRangeSummary(startDate: string, endDate: string, childId?: number): Promise<RangeSummary> {
  const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
  if (childId !== undefined) params.set("child_id", String(childId));
  return req(`/api/summary/range?${params}`);
}

/** Return rewards cheapest first; pass activeOnly for the child-facing catalog. */
export function fetchRewards(activeOnly = false): Promise<Reward[]> {
  return req(`/api/rewards?active_only=${activeOnly}`);
}

export function createReward(data: RewardCreate): Promise<Reward> {
  return req("/api/rewards", { method: "POST", body: JSON.stringify(data) });
}

export function updateReward(id: number, data: RewardUpdate): Promise<Reward> {
  return req(`/api/rewards/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteReward(id: number): Promise<void> {
  return req(`/api/rewards/${id}`, { method: "DELETE" });
}

/** Return redemption requests oldest first, optionally filtered by child and status. */
export function fetchRedemptions(childId?: number, status?: RedemptionStatus): Promise<RedemptionRequest[]> {
  const params = new URLSearchParams();
  if (childId !== undefined) params.set("child_id", String(childId));
  if (status) params.set("status", status);
  return req(`/api/redemptions?${params}`);
}

/** Request a reward for a child; rejects with HTTP 409 if it is inactive or costs more than the balance. */
export function requestRedemption(childId: number, rewardId: number): Promise<RedemptionRequest> {
  return req("/api/redemptions", { method: "POST", body: JSON.stringify({ child_id: childId, reward_id: rewardId }) });
}

/** Approve a pending request, deducting its cost; rejects with HTTP 409 if already resolved or unaffordable. */
export function approveRedemption(id: number): Promise<RedemptionRequest> {
  return req(`/api/redemptions/${id}/approve`, { method: "POST" });
}

/** Deny a pending request without deducting carrots. */
export function denyRedemption(id: number): Promise<RedemptionRequest> {
  return req(`/api/redemptions/${id}/deny`, { method: "POST" });
}
