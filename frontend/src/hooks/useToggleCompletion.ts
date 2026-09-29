"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleCompletion } from "@/lib/api";

/** Toggle a task completion on or off for the given date and optional child. */
export function useToggleCompletion(date: string, childId?: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: number }) =>
      toggleCompletion(taskId, date, childId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
