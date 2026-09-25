import { useQuery } from "@tanstack/react-query";
import { fetchCompletions } from "@/lib/api";

export function useCompletions(date: string, routine?: string) {
  return useQuery({
    queryKey: ["completions", date, routine ?? "all"],
    queryFn: () => fetchCompletions(date, routine),
    staleTime: 0,
  });
}
