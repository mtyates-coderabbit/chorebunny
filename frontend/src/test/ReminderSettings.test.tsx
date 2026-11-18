import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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


it("withholds controls on a failed initial load and retries", async () => {
  vi.mocked(api.fetchSettings).mockRejectedValueOnce(new Error("offline"));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ReminderSettings /></QueryClientProvider>);
  expect(screen.queryByLabelText("Morning routine reminder")).not.toBeInTheDocument();
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Morning routine reminder")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByLabelText("Morning routine reminder");
});

it.each(["Morning", "Evening"])("retries a failed %s clear and keeps the successful clear empty", async (routine) => {
  vi.mocked(api.fetchSettings).mockResolvedValue({ ...baseSettings, morning_reminder_time: "07:00", evening_reminder_time: "19:00" });
  vi.mocked(api.updateSettings).mockRejectedValueOnce(new Error("offline"));
  await renderSettings();
  const input = screen.getByLabelText(`${routine} routine reminder`);
  const buttons = screen.getAllByRole("button", { name: "Clear" });
  await userEvent.click(buttons[routine === "Morning" ? 0 : 1]);
  await screen.findByRole("button", { name: "Retry save" });
  expect(input).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(input).toHaveValue("");
  expect(api.updateSettings).toHaveBeenCalledTimes(2);
});

it("serializes edits, preserves the latest draft and cancels stale reads", async () => {
  let finishFirst!: (value: Settings) => void;
  let finishSecond!: (value: Settings) => void;
  vi.mocked(api.updateSettings)
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
  const client = await renderSettings();
  let finishRead!: (value: Settings) => void;
  vi.mocked(api.fetchSettings).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  void client.refetchQueries({ queryKey: ["settings"] });
  const input = screen.getByLabelText("Morning routine reminder");
  fireEvent.change(input, { target: { value: "07:00" } });
  await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "08:00" } });
  await act(async () => finishFirst({ ...baseSettings, morning_reminder_time: "07:00" }));
  await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(2));
  expect(input).toHaveValue("08:00");
  expect(client.getQueryData(["settings"])).toEqual(baseSettings);
  await act(async () => finishSecond({ ...baseSettings, morning_reminder_time: "08:00" }));
  await act(async () => finishRead(baseSettings));
  await waitFor(() => expect(client.getQueryData<Settings>(["settings"])?.morning_reminder_time).toBe("08:00"));
  expect(input).toHaveValue("08:00");
});
