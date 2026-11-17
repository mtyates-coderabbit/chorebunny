import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderSettings } from "@/components/ReminderSettings";
import type { Settings } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

import * as api from "@/lib/api";

const baseSettings: Settings = {
  morning_cutoff_hour: 12,
  carrots_per_dollar: 15,
  morning_reminder_time: null,
  evening_reminder_time: null,
};

async function renderSettings(initial: Settings = baseSettings) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ReminderSettings /></QueryClientProvider>);
  await screen.findByLabelText("Morning routine reminder");
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchSettings).mockResolvedValue(baseSettings);
  vi.mocked(api.updateSettings).mockImplementation(async (data) => ({ ...baseSettings, ...data }));
});

describe("ReminderSettings", () => {
  it("renders empty reminder fields by default", async () => {
    await renderSettings();
    expect(screen.getByLabelText("Morning routine reminder")).toHaveValue("");
    expect(screen.getByLabelText("Evening routine reminder")).toHaveValue("");
    expect(screen.queryByText("Clear", { selector: "button" })).not.toBeInTheDocument();
  });

  it("renders persisted reminder times", async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue({
      ...baseSettings,
      morning_reminder_time: "07:00",
      evening_reminder_time: "19:30",
    });
    await renderSettings();
    expect(screen.getByLabelText("Morning routine reminder")).toHaveValue("07:00");
    expect(screen.getByLabelText("Evening routine reminder")).toHaveValue("19:30");
  });

  it("saves the morning reminder time when changed", async () => {
    await renderSettings();
    const input = screen.getByLabelText("Morning routine reminder");
    await userEvent.type(input, "0700");
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ morning_reminder_time: "07:00" }));
  });

  it("saves the evening reminder time independently", async () => {
    await renderSettings();
    const input = screen.getByLabelText("Evening routine reminder");
    await userEvent.type(input, "1930");
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ evening_reminder_time: "19:30" }));
  });

  it("clears a reminder time with the Clear button", async () => {
    vi.mocked(api.fetchSettings).mockResolvedValue({ ...baseSettings, morning_reminder_time: "07:00" });
    await renderSettings();
    await userEvent.click(screen.getAllByRole("button", { name: "Clear" })[0]);
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledWith({ morning_reminder_time: null }));
    expect(screen.getByLabelText("Morning routine reminder")).toHaveValue("");
  });

  it("shows an error alert when saving fails", async () => {
    vi.mocked(api.updateSettings).mockRejectedValue(new Error("Save failed"));
    await renderSettings();
    await userEvent.type(screen.getByLabelText("Morning routine reminder"), "0700");
    await screen.findByRole("alert");
  });
});
