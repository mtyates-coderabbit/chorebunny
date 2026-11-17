import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSettings, updateSettings } from "@/lib/api";
import type { SettingsUpdate } from "@/lib/types";

/** Fetch current application settings. */
export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
}

/** Update settings and seed the cached value with the server's response on success. */
export function useSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SettingsUpdate) => updateSettings(data),
    onSuccess: (settings) => qc.setQueryData(["settings"], settings),
  });
}
