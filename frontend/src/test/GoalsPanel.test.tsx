import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoalsPanel } from "@/components/GoalsPanel";
import type { Goal } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchGoals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  completeGoal: vi.fn(),
}));

import * as api from "@/lib/api";

const goal = (overrides: Partial<Goal> = {}): Goal => ({
  id: 1, child_id: 1, name: "Lego set", target_dollars: 45,
  earned_dollars: 12.4, progress_percent: 27.6, created_at: "", completed_at: null,
  ...overrides,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GoalsPanel childId={1} />
    </QueryClientProvider>
  );
}

describe("GoalsPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchGoals).mockResolvedValue([]);
  });

  it('shows "Set your first goal!" when there are none', async () => {
    renderPanel();
    expect(await screen.findByText("Set your first goal!")).toBeInTheDocument();
  });

  it("shows progress toward an active goal", async () => {
    vi.mocked(api.fetchGoals).mockResolvedValue([goal()]);
    renderPanel();
    expect(await screen.findByText("Lego set")).toBeInTheDocument();
    expect(screen.getByText("$12.40 of $45.00")).toBeInTheDocument();
    expect(screen.queryByText("Lego set")).not.toHaveClass("line-through");
  });

  it("visually distinguishes a completed goal and hides the complete button", async () => {
    vi.mocked(api.fetchGoals).mockResolvedValue([
      goal({ completed_at: "2026-10-01T00:00:00", progress_percent: 100, earned_dollars: 45 }),
    ]);
    renderPanel();
    const name = await screen.findByText("Lego set");
    expect(name).toHaveClass("line-through");
    expect(name).toHaveClass("text-green-600");
    expect(screen.queryByRole("button", { name: "Mark complete" })).not.toBeInTheDocument();
  });

  it("offers to mark a fully-funded goal complete", async () => {
    vi.mocked(api.fetchGoals).mockResolvedValue([
      goal({ progress_percent: 100, earned_dollars: 45 }),
    ]);
    vi.mocked(api.completeGoal).mockResolvedValue(goal({ completed_at: "now", progress_percent: 100 }));
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Mark complete" }));
    expect(api.completeGoal).toHaveBeenCalledWith(1);
  });

  it("adds a goal with a name and dollar target, then clears the form", async () => {
    vi.mocked(api.createGoal).mockResolvedValue(goal({ earned_dollars: 0, progress_percent: 0 }));
    renderPanel();
    await screen.findByText("Set your first goal!");
    await userEvent.type(screen.getByLabelText("Goal name"), "Lego set");
    await userEvent.type(screen.getByLabelText("Target dollar amount"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(api.createGoal).toHaveBeenCalledWith({ child_id: 1, name: "Lego set", target_dollars: 45 });
    await waitFor(() => expect(screen.getByLabelText("Goal name")).toHaveValue(""));
  });

  it("does not submit without a name or a positive target", async () => {
    renderPanel();
    await screen.findByText("Set your first goal!");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(api.createGoal).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText("Goal name"), "Lego set");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(api.createGoal).not.toHaveBeenCalled();
  });

  it("removes a goal", async () => {
    vi.mocked(api.fetchGoals).mockResolvedValue([goal()]);
    vi.mocked(api.deleteGoal).mockResolvedValue(undefined);
    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Remove Lego set" }));
    expect(api.deleteGoal).toHaveBeenCalledWith(1);
  });

  it("shows an error when goals fail to load", async () => {
    vi.mocked(api.fetchGoals).mockRejectedValue(new Error("API 500"));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load goals");
  });
});
