import { useQuery } from "@tanstack/react-query";
import { fetchRangeSummary } from "@/lib/api";

/**
 * Query carrot totals for inclusive YYYY-MM-DD bounds, cached by both dates.
 * Return query data, loading state, and request errors through TanStack Query.
 */
export function useRangeSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["rangeSummary", startDate, endDate],
    queryFn: () => fetchRangeSummary(startDate, endDate),
  });
}
