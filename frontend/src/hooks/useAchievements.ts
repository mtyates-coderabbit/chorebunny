import { useQuery } from "@tanstack/react-query";
import { fetchAchievements } from "@/lib/api";

/** Fetch every achievement with a child's unlock state for each; disabled until a child is selected. */
export function useAchievements(childId?: number) {
  return useQuery({
    queryKey: ["achievements", childId ?? null],
    queryFn: () => fetchAchievements(childId!),
    enabled: childId !== undefined,
  });
}
