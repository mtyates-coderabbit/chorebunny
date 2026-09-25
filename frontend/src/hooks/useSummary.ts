import { useQuery } from "@tanstack/react-query";
import { fetchSummary } from "@/lib/api";

export function useSummary(date: string) {
  return useQuery({
    queryKey: ["summary", date],
    queryFn: () => fetchSummary(date),
    staleTime: 0,
  });
}
