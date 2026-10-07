import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MetricsView } from "@/components/MetricsView";
import type { RangeSummary, Task } from "@/lib/types";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({ fetchRangeSummary: vi.fn(), fetchTasks: vi.fn(), fetchChildren: vi.fn().mockResolvedValue([]) }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <>{children}</>,
  LineChart: ({ data }: { data: unknown }) => <output data-testid="trend">{JSON.stringify(data)}</output>,
  BarChart: () => null, Bar: () => null, Cell: () => null, Line: () => null,
  XAxis: () => null, YAxis: () => null, Tooltip: () => null, CartesianGrid: () => null,
}));

const range: RangeSummary = {
  start_date: "2026-01-28", end_date: "2026-02-02",
  days: ["2026-01-28", "2026-01-29", "2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"].map((date) => ({
    date, earned_carrots: 3, total_carrots: 6, morning_earned_carrots: 1, evening_earned_carrots: 2,
  })),
  task_stats: [],
};
const tasks: Task[] = [
  { id: 1, name: "Morning", routine: "morning", carrot_value: 2, estimated_minutes: null, is_active: true, description: null, sort_order: 0, created_at: "", assigned_child_ids: [] },
  { id: 2, name: "Evening", routine: "evening", carrot_value: 4, estimated_minutes: null, is_active: true, description: null, sort_order: 0, created_at: "", assigned_child_ids: [] },
];

function renderMetrics() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MetricsView /></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.fetchChildren).mockResolvedValue([]);
  vi.mocked(api.fetchRangeSummary).mockResolvedValue(range);
  vi.mocked(api.fetchTasks).mockImplementation(async (routine) => tasks.filter((task) => task.routine === routine));
});
afterEach(() => vi.useRealTimers());

describe("MetricsView", () => {
  it.each([0, 23])("requests local range dates at %i:30 across a DST boundary", async (hour) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 2, 10, hour, 30));
    renderMetrics();
    await screen.findByTestId("trend");
    expect(api.fetchRangeSummary).toHaveBeenCalledWith("2025-12-11", "2026-03-10", undefined);
  });

  it("uses each routine's earnings and matching total", async () => {
    renderMetrics();
    const trend = JSON.parse((await screen.findByTestId("trend")).textContent!);
    expect(trend[0]).toEqual({ date: "Jan 28", morning: 50, evening: 50 });
  });

  it("falls back to zero when routine totals are zero", async () => {
    vi.mocked(api.fetchTasks).mockResolvedValue([]);
    renderMetrics();
    const trend = JSON.parse((await screen.findByTestId("trend")).textContent!);
    expect(trend[0]).toEqual({ date: "Jan 28", morning: 0, evening: 0 });
  });

  it("aligns the first Wednesday and subsequent Sunday with their weekday rows", async () => {
    renderMetrics();
    const first = await screen.findByRole("img", { name: /^2026-01-28:/ });
    const sunday = screen.getByRole("img", { name: /^2026-02-01:/ });
    const column = first.parentElement!;
    expect(column.children).toHaveLength(7);
    expect(column.children[3]).toBe(first);
    for (const cell of Array.from(column.children).slice(0, 3)) {
      expect(cell).toHaveAttribute("aria-hidden", "true");
      expect(cell).not.toHaveAttribute("tabindex");
    }
    expect(column.nextElementSibling).toBe(sunday.parentElement);
    expect(sunday.parentElement!.firstElementChild).toBe(sunday);
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Feb")).toBeInTheDocument();
  });

  it("shows an error instead of metrics or the empty message", async () => {
    vi.mocked(api.fetchRangeSummary).mockRejectedValue(new Error("Unavailable"));
    renderMetrics();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load metrics");
    expect(screen.queryByText("90-day completion calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete some tasks to see stats here.")).not.toBeInTheDocument();
  });

  it.each(["loading", "error"])("keeps child filters usable during a child-specific %s state", async (state) => {
    const user = userEvent.setup();
    vi.mocked(api.fetchChildren).mockResolvedValue([
      { id: 1, name: "Alex", avatar: "🐰", color: "#F97316", created_at: "" },
      { id: 2, name: "Sam", avatar: "🐻", color: "#7DD3FC", created_at: "" },
    ]);
    vi.mocked(api.fetchRangeSummary).mockImplementation((_start, _end, childId) => {
      if (childId === 1) {
        return state === "loading" ? new Promise(() => {}) : Promise.reject(new Error("Unavailable"));
      }
      return Promise.resolve(range);
    });
    renderMetrics();
    await screen.findByTestId("trend");
    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Alex/ }));

    if (state === "loading") {
      expect(await screen.findByText("Loading metrics...")).toBeInTheDocument();
    } else {
      expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load metrics. Please try again.");
    }
    expect(screen.getByRole("button", { name: "All", pressed: false })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Alex/, pressed: true })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Sam/, pressed: false })).toBeEnabled();
    expect(screen.queryByText("90-day completion calendar")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete some tasks to see stats here.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Sam/ }));
    await screen.findByTestId("trend");
    expect(api.fetchRangeSummary).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), 2);
    expect(screen.getByRole("button", { name: /Sam/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alex/, pressed: false })).toBeInTheDocument();
    expect(screen.queryByText("Loading metrics...")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));
    await screen.findByTestId("trend");
    expect(api.fetchRangeSummary).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), undefined);
    expect(screen.getByRole("button", { name: "All", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sam/, pressed: false })).toBeInTheDocument();
  });

  it("keeps the loading state while the range is pending", () => {
    vi.mocked(api.fetchRangeSummary).mockReturnValue(new Promise(() => {}));
    renderMetrics();
    expect(screen.getByText("Loading metrics...")).toBeInTheDocument();
  });
});
