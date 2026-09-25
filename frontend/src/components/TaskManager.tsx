"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, deleteTask, fetchTasks, updateTask } from "@/lib/api";
import type { Task } from "@/lib/types";

export function TaskManager() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => fetchTasks(undefined, false),
  });

  const [form, setForm] = useState({
    name: "",
    description: "",
    routine: "morning" as "morning" | "evening",
    carrot_value: 1,
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setForm({ name: "", description: "", routine: "morning", carrot_value: 1 });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateTask(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate({ ...form, description: form.description || undefined });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Loading...</div>;

  const morning = tasks.filter((t) => t.routine === "morning");
  const evening = tasks.filter((t) => t.routine === "evening");

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-extrabold text-gray-800">⚙️ Task Manager</h1>

      {/* Add task form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
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
        <div className="flex gap-3">
          <select
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1"
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
      {[{ label: "☀️ Morning", items: morning }, { label: "🌙 Evening", items: evening }].map(
        ({ label, items }) => (
          <div key={label}>
            <h2 className="font-bold text-gray-600 mb-2">{label}</h2>
            <div className="space-y-2">
              {items.length === 0 && (
                <p className="text-gray-400 text-sm">No tasks yet.</p>
              )}
              {items.map((task: Task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border ${
                    task.is_active ? "border-gray-100" : "border-gray-100 opacity-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{task.name}</p>
                    {task.description && (
                      <p className="text-xs text-gray-400 truncate">{task.description}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">{"🥕".repeat(task.carrot_value)}</span>
                  <button
                    onClick={() =>
                      toggleActiveMutation.mutate({ id: task.id, is_active: !task.is_active })
                    }
                    className={`text-xs px-2 py-1 rounded-lg font-medium ${
                      task.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-400"
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
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
