"use client";

import { useState } from "react";
import { useChildren, useChildMutations } from "@/hooks/useChildren";
import type { Child } from "@/lib/types";

const AVATARS = ["🐰", "🐻", "🦊", "🐸", "🐼", "🦁", "🐮", "🐯"];
const COLORS = [
  { label: "Orange", value: "#F97316" },
  { label: "Sky", value: "#7DD3FC" },
  { label: "Green", value: "#4ADE80" },
  { label: "Purple", value: "#C084FC" },
  { label: "Pink", value: "#F9A8D4" },
  { label: "Yellow", value: "#FDE047" },
];

interface EditState {
  id: number;
  name: string;
  avatar: string;
  color: string;
}

/** Parent admin section for creating, editing, and deleting child profiles. */
export function ChildManager() {
  const { data: children = [], isLoading } = useChildren();
  const { create, update, remove } = useChildMutations();

  const [form, setForm] = useState({ name: "", avatar: "🐰", color: "#F97316" });
  const [editing, setEditing] = useState<EditState | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    create.mutate(form, { onSuccess: () => setForm({ name: "", avatar: "🐰", color: "#F97316" }) });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    update.mutate(
      { id: editing.id, data: { name: editing.name, avatar: editing.avatar, color: editing.color } },
      { onSuccess: () => setEditing(null) }
    );
  };

  if (isLoading) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 pt-6 space-y-4">
      <h2 className="text-xl font-extrabold text-gray-800">👧 Children</h2>

      {/* Add child form */}
      <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-bold text-gray-700">Add child</h3>
        <input
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Child's name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Avatar</p>
          <div className="flex gap-2 flex-wrap">
            {AVATARS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setForm({ ...form, avatar: a })}
                className={`text-xl w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-colors ${
                  form.avatar === a ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-500">Color</p>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setForm({ ...form, color: c.value })}
                title={c.label}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  form.color === c.value ? "border-gray-700 scale-110" : "border-transparent"
                }`}
                style={{ background: c.value }}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={create.isPending}
          className="w-full bg-orange-400 hover:bg-orange-500 text-white font-bold py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          {create.isPending ? "Adding..." : "Add child"}
        </button>
      </form>

      {/* Child list */}
      <div className="space-y-2">
        {children.length === 0 && (
          <p className="text-gray-400 text-sm">No children yet.</p>
        )}
        {children.map((child: Child) =>
          editing?.id === child.id ? (
            <form
              key={child.id}
              onSubmit={handleUpdate}
              className="bg-white rounded-xl px-4 py-3 shadow-sm border border-orange-200 space-y-3"
            >
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                required
              />
              <div className="flex gap-2 flex-wrap">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setEditing({ ...editing, avatar: a })}
                    className={`text-xl w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-colors ${
                      editing.avatar === a ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditing({ ...editing, color: c.value })}
                    title={c.label}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      editing.color === c.value ? "border-gray-700 scale-110" : "border-transparent"
                    }`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={update.isPending}
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
          ) : (
            <div
              key={child.id}
              className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100"
            >
              <span
                className="text-xl w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: child.color + "22" }}
              >
                {child.avatar}
              </span>
              <span className="flex-1 font-semibold text-gray-800 text-sm">{child.name}</span>
              <button
                onClick={() => setEditing({ id: child.id, name: child.name, avatar: child.avatar, color: child.color })}
                className="text-xs px-2 py-1 rounded-lg font-medium bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                Edit
              </button>
              <button
                onClick={() => remove.mutate(child.id)}
                disabled={remove.isPending}
                className="text-red-400 hover:text-red-600 text-lg leading-none disabled:opacity-50"
                title="Delete"
              >
                ×
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
