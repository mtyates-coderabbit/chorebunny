import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoutineView } from "@/components/RoutineView";
import type { Task, Completion, ToggleResult } from "@/lib/types";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

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
  beforeEach(() => {
    vi.mocked(api.fetchTasks).mockResolvedValue(MORNING_TASKS);
    vi.mocked(api.fetchCompletions).mockResolvedValue([]);
    vi.mocked(api.toggleCompletion).mockResolvedValue({
      action: "created",
      completion: { id: 1, task_id: 1, completion_date: "2026-09-25", completed_at: "" },
    } as ToggleResult);
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
