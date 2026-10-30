import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { completeGoal, createGoal, deleteGoal, fetchGoals, updateGoal } from "@/lib/api";
import type { GoalUpdate } from "@/lib/types";

/** Fetch a child's goals, active first then completed. */
export function useGoals(childId: number) {
  return useQuery({
    queryKey: ["goals", childId],
    queryFn: () => fetchGoals(childId),
  });
}

/** Mutations for creating, updating, completing, and deleting a child's goals. */
export function useGoalMutations(childId: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["goals", childId] });

  const create = useMutation({
    mutationFn: ({ name, target_dollars }: { name: string; target_dollars: number }) =>
      createGoal({ child_id: childId, name, target_dollars }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GoalUpdate }) => updateGoal(id, data),
    onSuccess: invalidate,
  });
  const complete = useMutation({ mutationFn: (id: number) => completeGoal(id), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: number) => deleteGoal(id), onSuccess: invalidate });

  return { create, update, complete, remove };
}
