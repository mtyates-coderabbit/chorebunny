import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskManager } from "@/components/TaskManager";
import type { Task } from "@/lib/types";

const tasks: Task[] = [
  { id: 1, name: "Brush teeth", description: "Use toothpaste", routine: "morning", carrot_value: 1, estimated_minutes: 5, is_active: true, sort_order: 0, created_at: "", assigned_child_ids: [] },
  { id: 2, name: "Make bed", description: null, routine: "morning", carrot_value: 1, estimated_minutes: null, is_active: false, sort_order: 0, created_at: "", assigned_child_ids: [] },
];
const fetchMock = vi.fn<typeof fetch>();

function renderManager() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><TaskManager /></QueryClientProvider>);
  return client;
}

async function startEditing() {
  renderManager();
  await screen.findByText("Brush teeth");
  await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(Response.json(tasks));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("TaskManager editing", () => {
  it("sends null to clear a description and closes the form on success", async () => {
    await startEditing();
    await userEvent.clear(screen.getByDisplayValue("Use toothpaste"));
    fetchMock.mockResolvedValueOnce(Response.json({ ...tasks[0], description: null }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ name: "Brush teeth", description: null, routine: "morning", carrot_value: 1, estimated_minutes: 5 }),
    }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());
  });

  it("shows save failures, keeps edits, and clears the error while retrying", async () => {
    await startEditing();
    await userEvent.type(screen.getByDisplayValue("Brush teeth"), " carefully");
    fetchMock.mockResolvedValueOnce(new Response("Save failed", { status: 500 }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
    expect(screen.getByDisplayValue("Brush teeth carefully")).toBeInTheDocument();
    let resolveSave!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await act(async () => resolveSave(Response.json(tasks[0])));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument());
  });

  it.each(["name", "description", "routine", "carrots", "estimate"])("clears the error when editing %s", async (field) => {
    await startEditing();
    fetchMock.mockResolvedValueOnce(new Response("Save failed", { status: 500 }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    if (field === "name") await userEvent.type(screen.getByDisplayValue("Brush teeth"), "!");
    if (field === "description") await userEvent.type(screen.getByDisplayValue("Use toothpaste"), "!");
    if (field === "routine") await userEvent.selectOptions(screen.getAllByRole("combobox")[2], "evening");
    if (field === "carrots") await userEvent.selectOptions(screen.getAllByRole("combobox")[3], "2");
    if (field === "estimate") await userEvent.clear(screen.getByDisplayValue("5"));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("clears an old save error when opening another task", async () => {
    await startEditing();
    fetchMock.mockResolvedValueOnce(new Response("Save failed", { status: 500 }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[1]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("TaskManager reordering", () => {
  it.each([204, 500])("sends one reorder request and refetches after status %i", async (status) => {
    const client = renderManager();
    client.setQueryData(["tasks", "all", null], tasks);
    await screen.findByText("Brush teeth");
    expect(screen.getAllByRole("button", { name: "Move up" })[0]).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Move down" })[1]).toBeDisabled();
    let resolveReorder!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveReorder = resolve; }));
    await userEvent.click(screen.getAllByRole("button", { name: "Move down" })[0]);
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/reorder", expect.objectContaining({ method: "POST", body: '{"direction":1}' }));
    expect(screen.getAllByRole("button", { name: "Move down" })[0]).toBeDisabled();
    await act(async () => resolveReorder(new Response(null, { status })));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[3][0]).toBe("/api/tasks?active_only=false");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Move down" })[0]).toBeEnabled());
  });
});

describe("TaskManager assignments", () => {
  const children = [
    { id: 1, name: "Alice", avatar: "🐰", color: "#F97316", created_at: "" },
    { id: 2, name: "Bob", avatar: "🐻", color: "#7DD3FC", created_at: "" },
  ];

  async function renderAssignments(assignedIds: number[], childCount = 2) {
    let task = { ...tasks[0], assigned_child_ids: assignedIds };
    fetchMock.mockImplementation(async (url, options) => {
      if (url === "/api/children") return Response.json(children.slice(0, childCount));
      if (url === "/api/tasks/1/assignments") {
        const { child_ids } = JSON.parse(options?.body as string) as { child_ids: number[] };
        task = { ...task, assigned_child_ids: child_ids };
        return Response.json(task);
      }
      return Response.json([task]);
    });
    renderManager();
    await screen.findByTitle("Remove Alice");
  }

  it.each([{ assigned: [1], childCount: 2 }, { assigned: [1], childCount: 1 }, { assigned: [], childCount: 1 }])(
    "prevents removing the last child with $assigned and $childCount children",
    async ({ assigned, childCount }) => {
      await renderAssignments(assigned, childCount);
      const remove = screen.getByTitle("Remove Alice");
      expect(remove).toBeDisabled();
      fetchMock.mockClear();
      await userEvent.click(remove);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it.each([{ assigned: [] }, { assigned: [1, 2] }])("removes a child from assignments $assigned without making the task global", async ({ assigned }) => {
    await renderAssignments(assigned);
    await userEvent.click(screen.getByTitle("Remove Alice"));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/assignments", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ child_ids: [2] }),
    }));
    await screen.findByTitle("Add Alice");
    expect(screen.getByTitle("Remove Bob")).toBeDisabled();
  });

  it("keeps all current children explicitly assigned until the parent restores global visibility", async () => {
    await renderAssignments([1]);
    await userEvent.click(screen.getByTitle("Add Bob"));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/assignments", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ child_ids: [1, 2] }),
    }));
    await waitFor(() => expect(screen.getByTitle("Remove Bob")).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: "Assign to all children" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks/1/assignments", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ child_ids: [] }),
    }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Assign to all children" })).not.toBeInTheDocument());
  });

  it.each(["toggle", "global"])("shows assignment failures and clears the alert during a %s retry", async (action) => {
    await renderAssignments([1]);
    const button = action === "toggle"
      ? screen.getByTitle("Add Bob")
      : screen.getByRole("button", { name: "Assign to all children" });
    fetchMock.mockResolvedValueOnce(new Response("Assignment update failed", { status: 500 }));
    await userEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Assignment update failed");
    expect(screen.getByTitle("Add Bob")).toBeInTheDocument();
    let resolveAssignment!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveAssignment = resolve; }));
    await userEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(button).toBeDisabled();
    await act(async () => resolveAssignment(Response.json(tasks[0])));
    await waitFor(() => expect(button).toBeEnabled());
  });
});
