import { useQuery } from "@tanstack/react-query";
import { fetchStreaks } from "@/lib/api";

/** Fetch current and longest completion streaks, optionally scoped to a routine and a child; disabled until a child is selected. */
export function useStreaks(routine?: string, childId?: number) {
  return useQuery({
    queryKey: ["streaks", routine ?? "all", childId ?? null],
    queryFn: () => fetchStreaks(routine, childId),
    enabled: childId !== undefined,
  });
}
