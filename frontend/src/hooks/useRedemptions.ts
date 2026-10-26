import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { approveRedemption, denyRedemption, fetchRedemptions, requestRedemption } from "@/lib/api";
import type { RedemptionStatus } from "@/lib/types";

/** Fetch redemption requests, optionally filtered by child and status. */
export function useRedemptions(childId?: number, status?: RedemptionStatus) {
  return useQuery({
    queryKey: ["redemptions", childId ?? null, status ?? null],
    queryFn: () => fetchRedemptions(childId, status),
  });
}

/** Request a reward on behalf of a child. */
export function useRequestRedemption(childId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: number) => requestRedemption(childId, rewardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["redemptions"] }),
  });
}

/** Approve or deny pending requests; approval also refreshes balances. */
export function useResolveRedemption() {
  const qc = useQueryClient();
  const onSettled = () => {
    qc.invalidateQueries({ queryKey: ["redemptions"] });
    qc.invalidateQueries({ queryKey: ["balance"] });
  };
  const approve = useMutation({ mutationFn: (id: number) => approveRedemption(id), onSettled });
  const deny = useMutation({ mutationFn: (id: number) => denyRedemption(id), onSettled });
  return { approve, deny };
}
