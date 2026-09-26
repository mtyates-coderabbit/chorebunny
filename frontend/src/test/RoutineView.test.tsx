import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoutineView } from "@/components/RoutineView";
import type { Task, Completion, ToggleResult } from "@/lib/types";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

const navigation = vi.hoisted(() => ({
  router: { push: vi.fn() },
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));

// Mock the API module
vi.mock("@/lib/api", () => ({
  fetchTasks: vi.fn(),
  fetchCompletions: vi.fn(),
  toggleCompletion: vi.fn(),
}));

import * as api from "@/lib/api";

const MORNING_TASKS: Task[] = [
  { id: 1, name: "Brush teeth", description: null, routine: "morning", carrot_value: 1, is_active: true, sort_order: 0, created_at: "" },
  { id: 2, name: "Make your bed", description: null, routine: "morning", carrot_value: 2, is_active: true, sort_order: 1, created_at: "" },
];

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("RoutineView", () => {
  afterEach(() => vi.useRealTimers());

  it.each([0, 23])("uses the local date in the header and query at %i:30", async (hour) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 10, hour, 30));
    vi.mocked(api.fetchCompletions).mockClear();
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText("Brush teeth");
    expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-10", "morning");
    expect(screen.getByText(/Today/)).toBeInTheDocument();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    navigation.searchParams = new URLSearchParams();
    vi.mocked(api.fetchTasks).mockResolvedValue(MORNING_TASKS);
    vi.mocked(api.fetchCompletions).mockResolvedValue([]);
    vi.mocked(api.toggleCompletion).mockResolvedValue({
      action: "created",
      completion: { id: 1, task_id: 1, completion_date: "2026-09-25", completed_at: "" },
    } as ToggleResult);
  });

  it.each(["", "invalid", "2026-2-03", "2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-03-00", "0000-01-01", "2026-03-10T00:00:00", "2026-03-11"])(
    "falls back to today for invalid or future date %j",
    async (date) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(2026, 2, 10, 12));
      navigation.searchParams.set("date", date);
      render(<RoutineView routine="morning" />, { wrapper: wrapper() });
      await screen.findByText("Brush teeth");
      expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-10", "morning");
      expect(screen.getByText(/Today/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
      expect(screen.getByRole("link", { name: /evening/ })).toHaveAttribute("href", "/evening?date=2026-03-10");
      await userEvent.click(screen.getByText("Brush teeth"));
      expect(api.toggleCompletion).toHaveBeenCalledWith(1, "2026-03-10");
    }
  );

  it.each(["morning", "evening"] as const)("preserves a valid leap day when switching from %s or navigating days", async (routine) => {
    navigation.searchParams.set("date", "2024-02-29");
    render(<RoutineView routine={routine} />, { wrapper: wrapper() });
    await screen.findByText("Brush teeth");
    expect(api.fetchCompletions).toHaveBeenCalledWith("2024-02-29", routine);
    expect(screen.getByText(/Thu, Feb 29/)).toBeInTheDocument();
    const other = routine === "morning" ? "evening" : "morning";
    expect(screen.getByRole("link", { name: new RegExp(other) })).toHaveAttribute("href", `/${other}?date=2024-02-29`);
    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(navigation.router.push).toHaveBeenLastCalledWith(`/${routine}?date=2024-02-28`);
    await userEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(navigation.router.push).toHaveBeenLastCalledWith(`/${routine}?date=2024-03-01`);
  });

  it("can celebrate the final task after navigating to another date", async () => {
    navigation.searchParams.set("date", "2026-03-09");
    vi.mocked(api.fetchCompletions).mockImplementation(async (date) => [
      { id: 1, task_id: 1, completion_date: date, completed_at: "" },
    ]);
    const { rerender } = render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText(/1\/2 done/);
    await userEvent.click(screen.getByText("Make your bed"));
    await screen.findByText("Amazing job!");

    await userEvent.click(screen.getByRole("button", { name: "Previous day" }));
    navigation.searchParams.set("date", "2026-03-08");
    rerender(<RoutineView routine="morning" />);
    expect(screen.queryByText("Amazing job!")).not.toBeInTheDocument();
    await screen.findByText(/1\/2 done/);
    await userEvent.click(screen.getByText("Make your bed"));
    await screen.findByText("Amazing job!");
    expect(api.toggleCompletion).toHaveBeenLastCalledWith(2, "2026-03-08");

    await userEvent.click(screen.getByRole("button", { name: /Woohoo/ }));
    await userEvent.click(screen.getByText("Make your bed"));
    await waitFor(() => expect(api.toggleCompletion).toHaveBeenCalledTimes(3));
    expect(screen.queryByText("Amazing job!")).not.toBeInTheDocument();
  });

  it("renders the routine heading", async () => {
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText(/morning routine/i);
  });

  it("renders all tasks fetched from the API", async () => {
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText("Brush teeth");
    expect(screen.getByText("Make your bed")).toBeInTheDocument();
  });

  it("shows 0/N done initially", async () => {
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText(/0\/2 done/);
  });

  it("calls toggleCompletion when a task card is clicked", async () => {
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await screen.findByText("Brush teeth");
    await userEvent.click(screen.getByText("Brush teeth").closest("button")!);
    expect(api.toggleCompletion).toHaveBeenCalledWith(1, expect.any(String));
  });

  it("shows celebration overlay when all tasks are completed sequentially", async () => {
    // First click: 1 of 2 done — no celebration yet
    vi.mocked(api.fetchCompletions)
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([{ id: 1, task_id: 1, completion_date: "2026-09-25", completed_at: "" }]) // after first toggle
      .mockResolvedValue([
        { id: 1, task_id: 1, completion_date: "2026-09-25", completed_at: "" },
        { id: 2, task_id: 2, completion_date: "2026-09-25", completed_at: "" },
      ]); // after second toggle

    vi.mocked(api.toggleCompletion)
      .mockResolvedValueOnce({ action: "created", completion: { id: 1, task_id: 1, completion_date: "2026-09-25", completed_at: "" } })
      .mockResolvedValueOnce({ action: "created", completion: { id: 2, task_id: 2, completion_date: "2026-09-25", completed_at: "" } });

    render(<RoutineView routine="morning" />, { wrapper: wrapper() });

    await screen.findByText("Brush teeth");
    await userEvent.click(screen.getByText("Brush teeth").closest("button")!);

    await screen.findByText("Make your bed");
    await userEvent.click(screen.getByText("Make your bed").closest("button")!);

    await waitFor(() => {
      expect(screen.queryByText("Amazing job!")).toBeInTheDocument();
    });
  });

  it("renders evening heading for evening routine", async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
    vi.mocked(api.fetchCompletions).mockResolvedValue([]);
    render(<RoutineView routine="evening" />, { wrapper: wrapper() });
    await screen.findByText(/evening routine/i);
  });
});
