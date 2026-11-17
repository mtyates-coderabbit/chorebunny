import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AchievementsView } from "@/components/AchievementsView";
import type { AchievementStatus, Child } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchChildren: vi.fn(),
  fetchAchievements: vi.fn(),
}));

import * as api from "@/lib/api";

const CHILDREN: Child[] = [
  { id: 1, name: "Alice", avatar: "🐰", color: "#F97316", created_at: "" },
  { id: 2, name: "Bob", avatar: "🐻", color: "#7DD3FC", created_at: "" },
];

const badge = (overrides: Partial<AchievementStatus> = {}): AchievementStatus => ({
  id: 1, name: "First Chore", description: "Complete your first chore.", icon: "🥕",
  unlocked: false, unlocked_at: null,
  ...overrides,
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AchievementsView />
    </QueryClientProvider>
  );
}

describe("AchievementsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchChildren).mockResolvedValue([]);
    vi.mocked(api.fetchAchievements).mockResolvedValue([]);
  });

  it("prompts to add a child when the household has none", async () => {
    renderView();
    expect(await screen.findByText(/Add a child in Settings/)).toBeInTheDocument();
  });

  it("requires a child to be selected before showing any badges", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    renderView();
    expect(await screen.findByText("Select a child to see their achievements")).toBeInTheDocument();
    expect(api.fetchAchievements).not.toHaveBeenCalled();
  });

  it("shows an unlocked badge in full color with its unlock date", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchAchievements).mockResolvedValue([
      badge({ unlocked: true, unlocked_at: "2026-03-10T12:00:00" }),
    ]);
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(api.fetchAchievements).toHaveBeenCalledWith(1);

    const entry = await screen.findByRole("listitem", { name: "First Chore, unlocked" });
    expect(entry.querySelector(".grayscale")).not.toBeInTheDocument();
    expect(screen.getByText("Mar 10, 2026")).toBeInTheDocument();
  });

  it("shows a locked badge as a greyscale silhouette with no date", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchAchievements).mockResolvedValue([badge()]);
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));

    const entry = await screen.findByRole("listitem", { name: "First Chore, locked" });
    expect(entry.querySelector(".grayscale")).toBeInTheDocument();
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
  });

  it("reveals name, description, and unlock date when tapping an unlocked badge", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchAchievements).mockResolvedValue([
      badge({ unlocked: true, unlocked_at: "2026-03-10T12:00:00" }),
    ]);
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    await userEvent.click(await screen.findByRole("listitem", { name: "First Chore, unlocked" }));

    const dialog = await screen.findByRole("dialog", { name: "First Chore" });
    expect(dialog).toHaveTextContent("Complete your first chore.");
    expect(dialog).toHaveTextContent("Unlocked Mar 10, 2026");
  });

  it("does not reveal the description when tapping a locked badge", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchAchievements).mockResolvedValue([badge()]);
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    await userEvent.click(await screen.findByRole("listitem", { name: "First Chore, locked" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete your first chore.")).not.toBeInTheDocument();
  });

  it("shows an error state when achievements fail to load", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    vi.mocked(api.fetchAchievements).mockRejectedValue(new Error("API 500"));
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Alice/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load achievements");
  });

  it("scopes the request to the selected child", async () => {
    vi.mocked(api.fetchChildren).mockResolvedValue(CHILDREN);
    renderView();
    await userEvent.click(await screen.findByRole("button", { name: /Bob/ }));
    expect(api.fetchAchievements).toHaveBeenCalledWith(2);
  });
});
