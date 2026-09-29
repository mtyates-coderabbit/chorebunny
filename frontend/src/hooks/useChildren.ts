import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchChildren, createChild, updateChild, deleteChild } from "@/lib/api";
import type { ChildCreate, ChildUpdate } from "@/lib/types";

/** Fetch all child profiles, ordered by creation time. */
export function useChildren() {
  return useQuery({
    queryKey: ["children"],
    queryFn: fetchChildren,
  });
}

/** Mutations for creating, updating, and deleting child profiles. */
export function useChildMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["children"] });

  const create = useMutation({ mutationFn: (data: ChildCreate) => createChild(data), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, data }: { id: number; data: ChildUpdate }) => updateChild(id, data), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: number) => deleteChild(id), onSuccess: invalidate });

  return { create, update, remove };
}
