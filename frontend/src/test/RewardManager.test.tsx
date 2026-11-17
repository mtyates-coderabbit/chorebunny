import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardManager } from "@/components/RewardManager";
import type { Reward } from "@/lib/types";
import { deferred } from "./deferred";

vi.mock("@/lib/api", () => ({
  fetchRewards: vi.fn(),
  createReward: vi.fn(),
  updateReward: vi.fn(),
  deleteReward: vi.fn(),
}));

import * as api from "@/lib/api";

const reward: Reward = { id: 1, name: "Ice cream", carrot_cost: 50, is_active: true, created_at: "" };

async function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><RewardManager /></QueryClientProvider>);
  await screen.findByText("Ice cream");
  await userEvent.type(screen.getByPlaceholderText("Reward name"), "Screen time");
  await userEvent.type(screen.getByPlaceholderText("Carrot cost"), "20");
}

async function failCreate() {
  vi.mocked(api.createReward).mockRejectedValue(new Error("Save failed"));
  await userEvent.click(screen.getByRole("button", { name: "Add reward" }));
  await screen.findByRole("alert");
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.fetchRewards).mockResolvedValue([reward]);
  vi.mocked(api.createReward).mockResolvedValue(reward);
  vi.mocked(api.updateReward).mockResolvedValue(reward);
  vi.mocked(api.deleteReward).mockResolvedValue(undefined);
});

describe("RewardManager create form", () => {
  it("labels the name and cost inputs so they have an accessible name", async () => {
    await renderManager();
    expect(screen.getByLabelText("New reward name")).toBe(screen.getByPlaceholderText("Reward name"));
    expect(screen.getByLabelText("New reward carrot cost")).toBe(screen.getByPlaceholderText("Carrot cost"));
  });

  it("shows field-specific detail for a 422 validation error", async () => {
    await renderManager();
    vi.mocked(api.createReward).mockRejectedValue(
      new Error('API 422: {"detail":[{"msg":"Input should be greater than or equal to 1"}]}')
    );
    await userEvent.click(screen.getByRole("button", { name: "Add reward" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save: Input should be greater than or equal to 1."
    );
  });

  it("shows a distinct message for a network/unreachable-server failure", async () => {
    await renderManager();
    vi.mocked(api.createReward).mockRejectedValue(new Error("Failed to fetch"));
    await userEvent.click(screen.getByRole("button", { name: "Add reward" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach the server. Check your connection and try again."
    );
  });
});

describe("RewardManager errors", () => {
  it.each([
    { form: "create", field: "Reward name" },
    { form: "create", field: "Carrot cost" },
    { form: "edit", field: "Reward name" },
    { form: "edit", field: "Carrot cost" },
  ])("clears errors when changing the $form $field", async ({ form, field }) => {
    await renderManager();
    if (form === "edit") await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await failCreate();
    const input = form === "edit" ? screen.getByLabelText(field) : screen.getByPlaceholderText(field);
    await userEvent.clear(input);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it.each(["Edit", "Add reward"])("clears a delete error when starting %s", async (action) => {
    await renderManager();
    vi.mocked(api.deleteReward).mockRejectedValue(new Error("Delete failed"));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    if (action === "Add reward") expect(api.createReward).toHaveBeenCalledWith({ name: "Screen time", carrot_cost: 20 });
  });

  it.each([true, false])("clears a create error when toggling active=$0", async (active) => {
    vi.mocked(api.fetchRewards).mockResolvedValue([{ ...reward, is_active: active }]);
    await renderManager();
    await failCreate();
    await userEvent.click(screen.getByRole("button", { name: active ? "Deactivate" : "Activate" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.updateReward).toHaveBeenCalledWith(1, { is_active: !active });
  });

  it("clears a create error when saving an edit", async () => {
    await renderManager();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await failCreate();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.updateReward).toHaveBeenCalledWith(1, { name: "Ice cream", carrot_cost: 50 });
  });

  it("clears an update error when deleting another reward", async () => {
    vi.mocked(api.fetchRewards).mockResolvedValue([reward, { ...reward, id: 2, name: "Screen time" }]);
    await renderManager();
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    vi.mocked(api.updateReward).mockRejectedValue(new Error("Save failed"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.deleteReward).toHaveBeenCalledWith(2);
  });

  it("keeps an in-flight create disabled when a field is edited", async () => {
    await renderManager();
    const result = deferred<Reward>();
    vi.mocked(api.createReward).mockReturnValue(result.promise);
    await userEvent.click(screen.getByRole("button", { name: "Add reward" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add reward" })).toBeDisabled());
    await userEvent.type(screen.getByPlaceholderText("Reward name"), "!");
    expect(screen.getByRole("button", { name: "Add reward" })).toBeDisabled();
    await act(async () => result.resolve(reward));
    await waitFor(() => expect(screen.getByPlaceholderText("Reward name")).toHaveValue(""));
  });
});
