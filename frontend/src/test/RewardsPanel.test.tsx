import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RewardsPanel } from "@/components/RewardsPanel";
import type { ChildBalance, RedemptionRequest, Reward } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchRewards: vi.fn(),
  fetchBalance: vi.fn(),
  fetchRedemptions: vi.fn(),
  requestRedemption: vi.fn(),
}));

import * as api from "@/lib/api";

const REWARDS: Reward[] = [
  { id: 1, name: "Ice cream", carrot_cost: 50, is_active: true, created_at: "" },
  { id: 2, name: "Screen time", carrot_cost: 20, is_active: true, created_at: "" },
];

const balance = (current_balance: number): ChildBalance => ({
  child_id: 1, current_balance, lifetime_earned: current_balance, lifetime_redeemed: 0, dollar_value: 0,
});

const redemption = (overrides: Partial<RedemptionRequest>): RedemptionRequest => ({
  id: 1, child_id: 1, reward_id: 1, reward_name: "Ice cream", carrot_cost: 50,
  status: "pending", created_at: "", resolved_at: null, ...overrides,
});

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RewardsPanel childId={1} />
    </QueryClientProvider>
  );
}

describe("RewardsPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchRewards).mockResolvedValue(REWARDS);
    vi.mocked(api.fetchRedemptions).mockResolvedValue([]);
  });

  it("disables rewards the child cannot afford", async () => {
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(30));
    renderPanel();
    const buttons = await screen.findAllByRole("button", { name: /^Ask for / });
    await waitFor(() => expect(buttons[0]).toBeDisabled());
    expect(buttons[1]).toBeEnabled();
  });

  it("requests the reward when tapped", async () => {
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    vi.mocked(api.requestRedemption).mockResolvedValue(redemption({}));
    renderPanel();
    const buttons = await screen.findAllByRole("button", { name: /^Ask for / });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    await userEvent.click(buttons[0]);
    expect(api.requestRedemption).toHaveBeenCalledWith(1, 1);
  });

  it("shows pending requests as waiting with no cancel option", async () => {
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    vi.mocked(api.fetchRedemptions).mockResolvedValue([redemption({})]);
    renderPanel();
    const waiting = await screen.findByRole("button", { name: "Waiting for a grown-up Ice cream" });
    expect(waiting).toBeDisabled();
    expect(screen.queryByText(/cancel/i)).not.toBeInTheDocument();
  });

  it("shows pending requests whose reward is no longer active", async () => {
    vi.mocked(api.fetchRewards).mockResolvedValue([]);
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    vi.mocked(api.fetchRedemptions).mockResolvedValue([redemption({ reward_id: null })]);
    renderPanel();
    expect(await screen.findByText("Waiting for a grown-up: Ice cream")).toBeInTheDocument();
  });

  it("tells the child when a request fails", async () => {
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    vi.mocked(api.requestRedemption).mockRejectedValue(new Error("API 409"));
    renderPanel();
    const buttons = await screen.findAllByRole("button", { name: /^Ask for / });
    await waitFor(() => expect(buttons[0]).toBeEnabled());
    await userEvent.click(buttons[0]);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows an error when rewards fail to load", async () => {
    vi.mocked(api.fetchRewards).mockRejectedValue(new Error("API 500"));
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load rewards");
  });

  it("shows denied requests", async () => {
    vi.mocked(api.fetchBalance).mockResolvedValue(balance(60));
    vi.mocked(api.fetchRedemptions).mockResolvedValue([redemption({ status: "denied" })]);
    renderPanel();
    expect(await screen.findByText("Not this time: Ice cream")).toBeInTheDocument();
  });
});
