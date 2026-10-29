import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedemptionQueue } from "@/components/RedemptionQueue";
import type { RedemptionRequest } from "@/lib/types";
import { deferred } from "./deferred";

vi.mock("@/lib/api", () => ({
  fetchChildren: vi.fn(),
  fetchRedemptions: vi.fn(),
  approveRedemption: vi.fn(),
  denyRedemption: vi.fn(),
}));

import * as api from "@/lib/api";

const request: RedemptionRequest = {
  id: 1, child_id: 1, reward_id: 1, reward_name: "Ice cream", carrot_cost: 50,
  status: "pending", created_at: "", resolved_at: null,
};

function renderQueue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><RedemptionQueue /></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchChildren).mockResolvedValue([
    { id: 1, name: "Alice", avatar: "🐰", color: "#F97316", created_at: "" },
  ]);
  vi.mocked(api.fetchRedemptions).mockResolvedValue([request]);
});

describe("RedemptionQueue errors", () => {
  it.each(["Approve", "Deny"])("keeps a failed %s visible when no requests remain", async (action) => {
    const mutation = action === "Approve" ? api.approveRedemption : api.denyRedemption;
    vi.mocked(mutation).mockRejectedValue(new Error("Already resolved"));
    const client = renderQueue();
    await screen.findByText("Ice cream");
    vi.mocked(api.fetchRedemptions).mockResolvedValue([]);
    await userEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(client.getQueryData(["redemptions", null, "pending"])).toEqual([]));
    await waitFor(() => expect(screen.queryByText("Ice cream")).not.toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't update that request");
  });

  it.each(["Approve", "Deny"])("clears the opposite error when starting %s", async (action) => {
    const failing = action === "Approve" ? api.denyRedemption : api.approveRedemption;
    const succeeding = action === "Approve" ? api.approveRedemption : api.denyRedemption;
    vi.mocked(failing).mockRejectedValue(new Error("Try again"));
    const result = deferred<RedemptionRequest>();
    vi.mocked(succeeding).mockReturnValue(result.promise);
    renderQueue();
    await screen.findByText("Ice cream");
    await userEvent.click(screen.getByRole("button", { name: action === "Approve" ? "Deny" : "Approve" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: action })).toBeDisabled();
    await act(async () => result.resolve({ ...request, status: action === "Approve" ? "approved" : "denied" }));
    await waitFor(() => expect(screen.getByRole("button", { name: action })).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
