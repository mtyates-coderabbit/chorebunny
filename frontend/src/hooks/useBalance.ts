import { useQuery } from "@tanstack/react-query";
import { fetchBalance } from "@/lib/api";

/** Fetch a child's carrot balance and dollar equivalent; disabled until a child is selected. */
export function useBalance(childId?: number) {
  return useQuery({
    queryKey: ["balance", childId ?? null],
    queryFn: () => fetchBalance(childId as number),
    enabled: childId !== undefined,
  });
}
