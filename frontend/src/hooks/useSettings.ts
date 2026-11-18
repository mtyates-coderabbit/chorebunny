import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/lib/api";
import type { SettingsUpdate } from "@/lib/types";

const queues = new WeakMap<QueryClient, { tail: Promise<unknown>; latest: number }>();

/** Fetch current application settings. */
export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
}

/** Serialize settings writes and publish only the latest submitted response. */
export function useSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ["settings"],
    retry: false,
    mutationFn: (data: SettingsUpdate) => {
      let queue = queues.get(qc);
      if (!queue) {
        queue = { tail: Promise.resolve(), latest: 0 };
        queues.set(qc, queue);
      }
      const current = queue;
      const id = ++current.latest;
      void qc.cancelQueries({ queryKey: ["settings"] });
      const request = current.tail.catch(() => undefined).then(async () => {
        const settings = await updateSettings(data);
        await qc.cancelQueries({ queryKey: ["settings"] });
        if (id === current.latest) qc.setQueryData(["settings"], settings);
        return settings;
      });
      current.tail = request.catch(() => undefined);
      return request;
    },
  });
}
