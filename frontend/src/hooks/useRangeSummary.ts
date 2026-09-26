import { useQuery } from "@tanstack/react-query";
import { fetchRangeSummary } from "@/lib/api";

export function useRangeSummary(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["rangeSummary", startDate, endDate],
    queryFn: () => fetchRangeSummary(startDate, endDate),
  });
}
