import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoutineView } from "@/components/RoutineView";
import type { Child, Task, ToggleResult } from "@/lib/types";

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
  fetchChildren: vi.fn().mockResolvedValue([]),
}));

import * as api from "@/lib/api";

const MORNING_TASKS: Task[] = [
  { id: 1, name: "Brush teeth", description: null, routine: "morning", carrot_value: 1, estimated_minutes: null, is_active: true, sort_order: 0, created_at: "" },
  { id: 2, name: "Make your bed", description: null, routine: "morning", carrot_value: 2, estimated_minutes: null, is_active: true, sort_order: 1, created_at: "" },
];

const CHILDREN: Child[] = [
  { id: 1, name: "Alice", avatar: "🐰", color: "#F97316", created_at: "" },
  { id: 2, name: "Bob", avatar: "🐻", color: "#7DD3FC", created_at: "" },
];

function wrapper(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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
    expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-10", "morning", undefined);
    expect(screen.getByText(/Today/)).toBeInTheDocument();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    navigation.searchParams = new URLSearchParams();
    vi.mocked(api.fetchChildren).mockResolvedValue([]);
    vi.mocked(api.fetchTasks).mockResolvedValue(MORNING_TASKS);
    vi.mocked(api.fetchCompletions).mockResolvedValue([]);
    vi.mocked(api.toggleCompletion).mockResolvedValue({
      action: "created",
      completion: { id: 1, task_id: 1, child_id: null, completion_date: "2026-09-25", completed_at: "" },
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
      expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-10", "morning", undefined);
      expect(screen.getByText(/Today/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();
      expect(screen.getByRole("link", { name: /evening/ })).toHaveAttribute("href", "/evening?date=2026-03-10");
      await userEvent.click(screen.getByText("Brush teeth"));
      expect(api.toggleCompletion).toHaveBeenCalledWith(1, "2026-03-10", undefined);
    }
  );

  it.each(["morning", "evening"] as const)("preserves a valid leap day when switching from %s or navigating days", async (routine) => {
    navigation.searchParams.set("date", "2024-02-29");
    render(<RoutineView routine={routine} />, { wrapper: wrapper() });
    await screen.findByText("Brush teeth");
    expect(api.fetchCompletions).toHaveBeenCalledWith("2024-02-29", routine, undefined);
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
      { id: 1, task_id: 1, child_id: null, completion_date: date, completed_at: "" },
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
    expect(api.toggleCompletion).toHaveBeenLastCalledWith(2, "2026-03-08", undefined);

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
    expect(api.toggleCompletion).toHaveBeenCalledWith(1, expect.any(String), undefined);
  });

  it("shows celebration overlay when all tasks are completed sequentially", async () => {
    // First click: 1 of 2 done — no celebration yet
    vi.mocked(api.fetchCompletions)
      .mockResolvedValueOnce([]) // initial load
      .mockResolvedValueOnce([{ id: 1, task_id: 1, child_id: null, completion_date: "2026-09-25", completed_at: "" }]) // after first toggle
      .mockResolvedValue([
        { id: 1, task_id: 1, child_id: null, completion_date: "2026-09-25", completed_at: "" },
        { id: 2, task_id: 2, child_id: null, completion_date: "2026-09-25", completed_at: "" },
      ]); // after second toggle

    vi.mocked(api.toggleCompletion)
      .mockResolvedValueOnce({ action: "created", completion: { id: 1, task_id: 1, child_id: null, completion_date: "2026-09-25", completed_at: "" } })
      .mockResolvedValueOnce({ action: "created", completion: { id: 2, task_id: 2, child_id: null, completion_date: "2026-09-25", completed_at: "" } });

    render(<RoutineView routine="morning" />, { wrapper: wrapper() });

    await screen.findByText("Brush teeth");
    await userEvent.click(screen.getByText("Brush teeth").closest("button")!);

    await screen.findByText("Make your bed");
    await userEvent.click(screen.getByText("Make your bed").closest("button")!);

    await waitFor(() => {
      expect(screen.queryByText("Amazing job!")).toBeInTheDocument();
    });
  });

  it("waits for children before showing tasks or fetching completions", async () => {
    const children = Promise.withResolvers<Child[]>();
    vi.mocked(api.fetchChildren).mockReturnValue(children.promise);
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    await waitFor(() => expect(api.fetchTasks).toHaveBeenCalled());
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
    expect(screen.queryByText(/done/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Rabbit mascot/)).not.toBeInTheDocument();
    expect(screen.queryByText(/carrots earned/)).not.toBeInTheDocument();
    expect(api.fetchCompletions).not.toHaveBeenCalled();

    await act(async () => children.resolve([]));
    await screen.findByText("Brush teeth");
    expect(api.fetchCompletions).toHaveBeenCalledWith(expect.any(String), "morning", undefined);
    expect(screen.getByText(/0\/2 done/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rabbit mascot/)).toBeInTheDocument();
    expect(screen.getByText("0 / 3 carrots earned")).toBeInTheDocument();
  });

  it.each([{ children: [] }, { children: CHILDREN }])("blocks tasks on a children error and recovers after retry ($children)", async ({ children }) => {
    vi.mocked(api.fetchChildren)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue(children);
    render(<RoutineView routine="morning" />, { wrapper: wrapper() });
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load children");
    expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
    expect(screen.queryByText(/done/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Rabbit mascot/)).not.toBeInTheDocument();
    expect(screen.queryByText(/carrots earned/)).not.toBeInTheDocument();
    expect(api.fetchCompletions).not.toHaveBeenCalled();
    expect(api.toggleCompletion).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    if (children.length > 0) {
      await screen.findByText("Select a child to start");
      expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
      expect(api.fetchCompletions).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: /Alice/ }));
    }
    await screen.findByText("Brush teeth");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.fetchCompletions).toHaveBeenCalledWith(expect.any(String), "morning", children[0]?.id);
  });

  it("hides cached progress until selection and loads completions for each selected child", async () => {
    navigation.searchParams.set("date", "2026-03-09");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["completions", "2026-03-09", "morning", null], [
      { id: 1, task_id: 1, child_id: null, completion_date: "2026-03-09", completed_at: "" },
    ]);
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    const completions = Promise.withResolvers<Awaited<ReturnType<typeof api.fetchCompletions>>>();
    vi.mocked(api.fetchCompletions).mockReturnValueOnce(completions.promise);
    render(<RoutineView routine="morning" />, { wrapper: wrapper(qc) });
    await screen.findByText("Select a child to start");
    expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
    expect(screen.queryByText(/done/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Rabbit mascot/)).not.toBeInTheDocument();
    expect(screen.queryByText(/carrots earned/)).not.toBeInTheDocument();
    expect(api.fetchCompletions).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Alice/ }));
    await waitFor(() => expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-09", "morning", 1));
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Brush teeth")).not.toBeInTheDocument();
    await act(async () => completions.resolve([]));
    await screen.findByText("Brush teeth");
    expect(screen.getByText(/0\/2 done/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Rabbit mascot/)).toBeInTheDocument();
    expect(screen.getByText("0 / 3 carrots earned")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Brush teeth"));
    expect(api.toggleCompletion).toHaveBeenLastCalledWith(1, "2026-03-09", 1);

    await userEvent.click(screen.getByRole("button", { name: /Bob/ }));
    await waitFor(() => expect(api.fetchCompletions).toHaveBeenCalledWith("2026-03-09", "morning", 2));
    await screen.findByText("Brush teeth");
    await userEvent.click(screen.getByText("Brush teeth"));
    expect(api.toggleCompletion).toHaveBeenLastCalledWith(1, "2026-03-09", 2);
  });

  it("renders evening heading for evening routine", async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
    vi.mocked(api.fetchCompletions).mockResolvedValue([]);
    render(<RoutineView routine="evening" />, { wrapper: wrapper() });
    await screen.findByText(/evening routine/i);
  });
});
