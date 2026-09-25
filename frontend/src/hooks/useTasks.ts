import { useQuery } from "@tanstack/react-query";
import { fetchTasks } from "@/lib/api";

export function useTasks(routine?: string) {
  return useQuery({
    queryKey: ["tasks", routine ?? "all"],
    queryFn: () => fetchTasks(routine),
    staleTime: 5 * 60 * 1000,
  });
}
