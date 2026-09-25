"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleCompletion } from "@/lib/api";

export function useToggleCompletion(date: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId }: { taskId: number }) =>
      toggleCompletion(taskId, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["completions"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
