import { useQuery } from "@tanstack/react-query";
import { fetchCompletions } from "@/lib/api";

/** Fetch completions for a date, optionally filtered by routine and child. */
export function useCompletions(date: string, routine?: string, childId?: number, enabled = true) {
  return useQuery({
    queryKey: ["completions", date, routine ?? "all", childId ?? null],
    queryFn: () => fetchCompletions(date, routine, childId),
    enabled,
    staleTime: 0,
  });
}
