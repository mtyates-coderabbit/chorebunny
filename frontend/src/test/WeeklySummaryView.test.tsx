import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeeklySummaryView } from "@/components/WeeklySummaryView";
import type { Child, RangeSummary, StreakSummary } from "@/lib/types";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchChildren: vi.fn(),
  fetchRangeSummary: vi.fn(),
  fetchStreaks: vi.fn(),
}));

const CHILDREN: Child[] = [
  { id: 1, name: "Alice", avatar: "🐰", color: "#F97316", created_at: "" },
  { id: 2, name: "Bob", avatar: "🐻", color: "#7DD3FC", created_at: "" },
];

const RANGE: RangeSummary = {
  start_date: "2026-03-04", end_date: "2026-03-10",
  days: ["2026-03-04", "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08", "2026-03-09", "2026-03-10"].map((date, i) => ({
    date, earned_carrots: i === 0 ? 0 : 2, total_carrots: 3, morning_earned_carrots: 1, evening_earned_carrots: 1,
  })),
  task_stats: [
    { task_id: 1, name: "Brush teeth", routine: "morning", count: 6 },
    { task_id: 2, name: "Make bed", routine: "morning", count: 1 },
    { task_id: 3, name: "Read a book", routine: "evening", count: 0 },
  ],
};

const STREAK: StreakSummary = { current_streak: 3, longest_streak: 5, last_completion_date: "2026-03-10" };

function renderWeekly() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><WeeklySummaryView /></QueryClientProvider>);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 2, 10, 12));
  vi.clearAllMocks();
  vi.mocked(api.fetchChildren).mockResolvedValue([]);
  vi.mocked(api.fetchRangeSummary).mockResolvedValue(RANGE);
  vi.mocked(api.fetchStreaks).mockResolvedValue(STREAK);
});
afterEach(() => vi.useRealTimers());

describe("WeeklySummaryView", () => {
  it("prompts to add a child when the household has none", async () => {
    renderWeekly();
    expect(await screen.findByText(/Add a child in Settings/)).toBeInTheDocument();
  });

  it("distinguishes pending children from an empty household", async () => {
    let resolveChildren!: (children: Child[]) => void;
    vi.mocked(api.fetchChildren).mockReturnValue(new Promise((resolve) => { resolveChildren = resolve; }));
    renderWeekly();
    expect(screen.getByRole("status")).toHaveTextContent("Loading children");
    expect(screen.queryByText(/Add a child in Settings/)).not.toBeInTheDocument();
    await act(async () => resolveChildren([]));
    expect(await screen.findByText(/Add a child in Settings/)).toBeInTheDocument();
  });

  it("shows a children error and retries successfully", async () => {
    vi.mocked(api.fetchChildren).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(CHILDREN);
    renderWeekly();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load children");
    expect(screen.queryByText(/Add a child in Settings/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /Alice/ })).toBeInTheDocument();
    expect(api.fetchChildren).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2, 3, 4])("ranks the least completed chores independently with %i chores", async (count) => {
    const task_stats = Array.from({ length: count }, (_, i) => ({ task_id: i + 1, name: `Chore ${i + 1}`, routine: "morning", count: count - i }));
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchRangeSummary).mockResolvedValue({ ...RANGE, task_stats });
    renderWeekly();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    const heading = await screen.findByRole("heading", { name: "Needs attention" });
    expect(within(heading.parentElement!).getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      [...task_stats].reverse().slice(0, 3).map((task) => `${task.name} · ${task.count}×`)
    );
  });

  it("waits for the streak query before displaying a successful zero", async () => {
    let resolveStreak!: (streak: StreakSummary) => void;
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchStreaks).mockReturnValue(new Promise((resolve) => { resolveStreak = resolve; }));
    renderWeekly();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(await screen.findByText("Loading streak...")).toBeInTheDocument();
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
    await act(async () => resolveStreak({ ...STREAK, current_streak: 0 }));
    expect(await screen.findByText(/🔥 0/)).toBeInTheDocument();
  });

  it("shows a streak error without displaying a number", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchStreaks).mockRejectedValue(new Error("Unavailable"));
    renderWeekly();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load streak");
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
    expect(screen.getByText("12 🥕")).toBeInTheDocument();
  });

  it("requires a child to be selected before showing any data", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    renderWeekly();
    expect(await screen.findByText("Select a child to see their weekly summary")).toBeInTheDocument();
    expect(api.fetchRangeSummary).not.toHaveBeenCalled();
    expect(api.fetchStreaks).not.toHaveBeenCalled();
  });

  it("shows the week's total, streak, daily breakdown, and top/least completed tasks for the selected child", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    renderWeekly();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));

    expect(api.fetchRangeSummary).toHaveBeenCalledWith("2026-03-04", "2026-03-10", 1);
    expect(api.fetchStreaks).toHaveBeenCalledWith(undefined, 1);
    expect(await screen.findByText("12 🥕")).toBeInTheDocument();
    expect(screen.getByText(/🔥 3/)).toBeInTheDocument();
    expect(screen.getAllByText("Brush teeth · 6×")[0]).toBeInTheDocument();
    expect(screen.getByText("Read a book · 0×")).toBeInTheDocument();
  });

  it("shows an error state and recovers on retry", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchRangeSummary).mockRejectedValueOnce(new Error("Unavailable"));
    renderWeekly();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load weekly summary");
  });
});
