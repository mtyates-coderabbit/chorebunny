import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createReward, deleteReward, fetchRewards, updateReward } from "@/lib/api";
import type { RewardCreate, RewardUpdate } from "@/lib/types";

/** Fetch rewards cheapest first; activeOnly limits to the child-facing catalog. */
export function useRewards(activeOnly = false) {
  return useQuery({
    queryKey: ["rewards", activeOnly],
    queryFn: () => fetchRewards(activeOnly),
  });
}

/** Mutations for creating, updating, and deleting rewards. */
export function useRewardMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rewards"] });

  const create = useMutation({ mutationFn: (data: RewardCreate) => createReward(data), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, data }: { id: number; data: RewardUpdate }) => updateReward(id, data), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: (id: number) => deleteReward(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["redemptions"] });
    },
  });

  return { create, update, remove };
}
