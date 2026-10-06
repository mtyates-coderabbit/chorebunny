"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, deleteTask, fetchChildren, fetchTasks, reorderTask, setTaskAssignments, updateTask } from "@/lib/api";
import type { Child, Task } from "@/lib/types";

interface EditState {
  id: number;
  name: string;
  description: string;
  routine: "morning" | "evening";
  carrot_value: number;
  estimated_minutes: string;
}

/** Manage task creation, inline editing, reorder, visibility, and deletion by routine. */
export function TaskManager() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "all", null],
    queryFn: () => fetchTasks(undefined, false),
  });
  const { data: children = [] } = useQuery({
    queryKey: ["children"],
    queryFn: fetchChildren,
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    routine: "morning" as "morning" | "evening",
    carrot_value: 1,
    estimated_minutes: "",
  });
  const [editing, setEditing] = useState<EditState | null>(null);

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setForm({ name: "", description: "", routine: "morning", carrot_value: 1, estimated_minutes: "" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const reorderMutation = useMutation({
    mutationFn: ({ id, direction }: { id: number; direction: -1 | 1 }) =>
      reorderTask(id, direction),
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, child_ids }: { id: number; child_ids: number[] }) =>
      setTaskAssignments(id, { child_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate({
      ...form,
      description: form.description || undefined,
      estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : undefined,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.reset();
    if (!editing || !editing.name.trim()) return;
    updateMutation.mutate(
      {
        id: editing.id,
        data: {
          name: editing.name,
          description: editing.description || null,
          routine: editing.routine,
          carrot_value: editing.carrot_value,
          estimated_minutes: editing.estimated_minutes ? Number(editing.estimated_minutes) : null,
        },
      },
      { onSuccess: () => setEditing(null) }
    );
  };

  const changeEdit = (fields: Partial<EditState>) => {
    if (updateMutation.error) updateMutation.reset();
    setEditing((current) => current && { ...current, ...fields });
  };

  const startEdit = (task: Task) => {
    updateMutation.reset();
    setEditing({
      id: task.id,
      name: task.name,
      description: task.description ?? "",
      routine: task.routine,
      carrot_value: task.carrot_value,
      estimated_minutes: task.estimated_minutes?.toString() ?? "",
    });
  };

  const moveTask = (task: Task, direction: -1 | 1) => {
    const siblings = tasks
      .filter((t) => t.routine === task.routine)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    const idx = siblings.findIndex((t) => t.id === task.id);
    const neighbor = siblings[idx + direction];
    if (!neighbor) return;
    reorderMutation.mutate({ id: task.id, direction });
  };

  const assignChildren = (task: Task, childIds: number[]) => {
    assignMutation.reset();
    assignMutation.mutate({ id: task.id, child_ids: childIds });
  };

  const toggleChildAssignment = (task: Task, childId: number) => {
    const assigned = task.assigned_child_ids;
    const isGlobal = assigned.length === 0;
    const isAssigned = isGlobal || assigned.includes(childId);
    let newIds: number[];
    if (isGlobal) {
      newIds = children.filter((c) => c.id !== childId).map((c) => c.id);
    } else if (isAssigned) {
      newIds = assigned.filter((id) => id !== childId);
    } else {
      newIds = [...assigned, childId];
    }
    if (newIds.length === 0) return;
    assignChildren(task, newIds);
  };

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>;

  const morning = tasks
    .filter((t) => t.routine === "morning")
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const evening = tasks
    .filter((t) => t.routine === "evening")
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const renderTask = (task: Task, idx: number, siblings: Task[]) => {
    if (editing?.id === task.id) {
      return (
        <form
          key={task.id}
          onSubmit={handleSaveEdit}
          className="bg-white rounded-xl px-4 py-3 shadow-sm border border-orange-200 space-y-2"
        >
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={editing.name}
            onChange={(e) => changeEdit({ name: e.target.value })}
            required
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={editing.description}
            onChange={(e) => changeEdit({ description: e.target.value })}
          />
          <div className="flex gap-3 flex-wrap">
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={editing.routine}
              onChange={(e) => changeEdit({ routine: e.target.value as "morning" | "evening" })}
            >
              <option value="morning">☀️ Morning</option>
              <option value="evening">🌙 Evening</option>
            </select>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-500">Carrots:</label>
              <select
                className="border border-gray-200 rounded-xl px-2 py-2 text-sm"
                value={editing.carrot_value}
                onChange={(e) => changeEdit({ carrot_value: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"🥕".repeat(n)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-500 whitespace-nowrap">⏱ min:</label>
              <input
                type="number"
                min={1}
                max={180}
                className="border border-gray-200 rounded-xl px-2 py-2 text-sm w-16"
                placeholder="—"
                value={editing.estimated_minutes}
                onChange={(e) => changeEdit({ estimated_minutes: e.target.value })}
              />
            </div>
          </div>
          {updateMutation.error && (
            <p role="alert" className="text-sm text-red-500">{updateMutation.error.message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 bg-orange-400 hover:bg-orange-500 text-white font-bold py-1.5 rounded-xl text-sm disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-1.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      );
    }

    return (
      <div
        key={task.id}
        className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border ${
          task.is_active ? "border-gray-100" : "border-gray-100 opacity-50"
        }`}
      >
        {/* Reorder buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => moveTask(task, -1)}
            disabled={idx === 0 || updateMutation.isPending || reorderMutation.isPending}
            className="text-gray-300 hover:text-gray-500 text-xs leading-none disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Move up"
          >
            ▲
          </button>
          <button
            onClick={() => moveTask(task, 1)}
            disabled={idx === siblings.length - 1 || updateMutation.isPending || reorderMutation.isPending}
            className="text-gray-300 hover:text-gray-500 text-xs leading-none disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Move down"
          >
            ▼
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 text-sm">{task.name}</p>
          {task.description && (
            <p className="text-xs text-gray-400 truncate">{task.description}</p>
          )}
          {children.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {children.map((child: Child) => {
                const isGlobal = task.assigned_child_ids.length === 0;
                const active = isGlobal || task.assigned_child_ids.includes(child.id);
                const isLastAssigned = active && (isGlobal ? children.length : task.assigned_child_ids.length) === 1;
                return (
                  <button
                    key={child.id}
                    onClick={() => toggleChildAssignment(task, child.id)}
                    disabled={assignMutation.isPending || isLastAssigned}
                    title={active ? `Remove ${child.name}` : `Add ${child.name}`}
                    className={`text-xs px-1.5 py-0.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      active
                        ? "text-white border-transparent"
                        : "bg-white text-gray-400 border-gray-200 hover:border-orange-300"
                    }`}
                    style={active ? { background: child.color, borderColor: child.color } : undefined}
                  >
                    {child.avatar}
                  </button>
                );
              })}
              {task.assigned_child_ids.length > 0 && (
                <button
                  onClick={() => assignChildren(task, [])}
                  disabled={assignMutation.isPending}
                  className="text-xs px-1.5 py-0.5 rounded-lg border border-gray-200 text-gray-500 hover:border-orange-300 disabled:opacity-50"
                >
                  Assign to all children
                </button>
              )}
            </div>
          )}
        </div>
        {task.estimated_minutes && (
          <span className="text-xs text-gray-400 whitespace-nowrap">⏱ {task.estimated_minutes}m</span>
        )}
        <span className="text-sm text-gray-400">{"🥕".repeat(task.carrot_value)}</span>
        <button
          onClick={() => startEdit(task)}
          className="text-xs px-2 py-1 rounded-lg font-medium bg-gray-100 text-gray-500 hover:bg-gray-200"
        >
          Edit
        </button>
        <button
          onClick={() =>
            updateMutation.mutate({ id: task.id, data: { is_active: !task.is_active } })
          }
          className={`text-xs px-2 py-1 rounded-lg font-medium ${
            task.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
          }`}
        >
          {task.is_active ? "Active" : "Hidden"}
        </button>
        <button
          onClick={() => deleteMutation.mutate(task.id)}
          className="text-red-400 hover:text-red-600 text-lg leading-none"
          title="Delete"
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-extrabold text-gray-800">⚙️ Task Manager</h1>

      {/* Add task form */}
      <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h2 className="font-bold text-gray-700">Add new task</h2>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Task name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex gap-3 flex-wrap">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm"
            value={form.routine}
            onChange={(e) => setForm({ ...form, routine: e.target.value as "morning" | "evening" })}
          >
            <option value="morning">☀️ Morning</option>
            <option value="evening">🌙 Evening</option>
          </select>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500">Carrots:</label>
            <select
              className="border border-gray-200 rounded-xl px-2 py-2 text-sm"
              value={form.carrot_value}
              onChange={(e) => setForm({ ...form, carrot_value: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{"🥕".repeat(n)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-500 whitespace-nowrap">⏱ min:</label>
            <input
              type="number"
              min={1}
              max={180}
              className="border border-gray-200 rounded-xl px-2 py-2 text-sm w-16"
              placeholder="—"
              value={form.estimated_minutes}
              onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value })}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? "Adding..." : "Add task"}
        </button>
      </form>

      {/* Task lists */}
      {assignMutation.error && (
        <p role="alert" className="text-sm text-red-500">{assignMutation.error.message}</p>
      )}
      {[
        { label: "☀️ Morning", items: morning },
        { label: "🌙 Evening", items: evening },
      ].map(({ label, items }) => (
        <div key={label}>
          <h2 className="font-bold text-gray-600 mb-2">{label}</h2>
          <div className="space-y-2">
            {items.length === 0 && <p className="text-gray-400 text-sm">No tasks yet.</p>}
            {items.map((task, idx) => renderTask(task, idx, items))}
          </div>
        </div>
      ))}
    </div>
  );
}
