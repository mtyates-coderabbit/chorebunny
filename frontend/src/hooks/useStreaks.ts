import { useQuery } from "@tanstack/react-query";
import { fetchStreaks } from "@/lib/api";

/** Fetch a routine's current and longest completion streaks, scoped to a child; disabled until a child is selected. */
export function useStreaks(routine: string, childId?: number) {
  return useQuery({
    queryKey: ["streaks", routine, childId ?? null],
    queryFn: () => fetchStreaks(routine, childId),
    enabled: childId !== undefined,
  });
}
