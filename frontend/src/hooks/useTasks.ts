import { useQuery } from "@tanstack/react-query";
import { fetchTasks } from "@/lib/api";

/** Fetch tasks for a routine, optionally scoped to what a specific child can see. */
export function useTasks(routine?: string, childId?: number) {
  return useQuery({
    queryKey: ["tasks", routine ?? "all", childId ?? null],
    queryFn: () => fetchTasks(routine, true, childId),
    staleTime: 5 * 60 * 1000,
  });
}
