"use client";

import { useState } from "react";
import { useRewardMutations, useRewards } from "@/hooks/useRewards";

interface EditState {
  id: number;
  name: string;
  carrot_cost: string;
}

/** Translate a thrown API error into actionable text; `req()` in api.ts throws `API {status}: {body}` for HTTP failures. */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const match = message.match(/^API (\d+): ([\s\S]*)$/);
  if (!match) return "Couldn't reach the server. Check your connection and try again.";
  const [, status, body] = match;
  if (status === "422") {
    try {
      const parsed = JSON.parse(body) as { detail?: { msg: string }[] };
      const detail = parsed.detail?.[0]?.msg;
      if (detail) return `Couldn't save: ${detail}.`;
    } catch {
      // body wasn't JSON; fall through to the generic 422 message below
    }
    return "Couldn't save: the name can't be blank and the cost must be a whole number of at least 1.";
  }
  if (status === "401" || status === "403") return "You're signed out. Refresh the page and try again.";
  if (status === "404") return "That reward no longer exists. Refresh the page to see the current list.";
  return `Couldn't save that change (server error ${status}). Try again in a moment.`;
}

/** Parent admin section for creating, editing, deactivating, and deleting rewards. */
export function RewardManager() {
  const { data: rewards = [], isLoading } = useRewards();
  const { create, update, remove } = useRewardMutations();

  const [form, setForm] = useState({ name: "", carrot_cost: "" });
  const [editing, setEditing] = useState<EditState | null>(null);

  const resetErrors = () => {
    if (create.isError) create.reset();
    if (update.isError) update.reset();
    if (remove.isError) remove.reset();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();
    if (!form.name.trim()) return;
    create.mutate(
      { name: form.name, carrot_cost: Number(form.carrot_cost) },
      { onSuccess: () => setForm({ name: "", carrot_cost: "" }) }
    );
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    resetErrors();
    if (!editing || !editing.name.trim()) return;
    update.mutate(
      { id: editing.id, data: { name: editing.name, carrot_cost: Number(editing.carrot_cost) } },
      { onSuccess: () => setEditing(null) }
    );
  };

  const errors = [
    { operation: "Create", mutation: create },
    { operation: "Update", mutation: update },
    { operation: "Delete", mutation: remove },
  ].filter(({ mutation }) => mutation.isError);

  if (isLoading) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 pt-6 space-y-4">
      <h2 className="text-xl font-extrabold text-gray-800">🎁 Rewards</h2>

      <form onSubmit={handleCreate} onChange={resetErrors} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-bold text-gray-700">Add reward</h3>
        <input
          aria-label="New reward name"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Reward name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          aria-label="New reward carrot cost"
          type="number"
          min={1}
          step={1}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          placeholder="Carrot cost"
          value={form.carrot_cost}
          onChange={(e) => setForm({ ...form, carrot_cost: e.target.value })}
          required
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="bg-orange-500 text-white font-bold text-sm rounded-xl px-4 py-2 disabled:opacity-50"
        >
          Add reward
        </button>
      </form>

      {errors.map(({ operation, mutation }) => (
        <p key={operation} role="alert" className="text-sm text-red-500">
          {errors.length > 1 && `${operation}: `}
          {describeError(mutation.error)}
        </p>
      ))}

      <ul className="space-y-2">
        {rewards.map((reward) => (
          <li key={reward.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            {editing?.id === reward.id ? (
              <form onSubmit={handleUpdate} onChange={resetErrors} className="space-y-2">
                <input
                  aria-label="Reward name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
                <input
                  aria-label="Carrot cost"
                  type="number"
                  min={1}
                  step={1}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={editing.carrot_cost}
                  onChange={(e) => setEditing({ ...editing, carrot_cost: e.target.value })}
                  required
                />
                <div className="flex gap-2">
                  <button type="submit" className="bg-orange-500 text-white font-bold text-sm rounded-xl px-3 py-1.5">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetErrors();
                      setEditing(null);
                    }}
                    className="text-sm text-gray-500 rounded-xl px-3 py-1.5 border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className={`flex items-center gap-3 ${reward.is_active ? "" : "opacity-50"}`}>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{reward.name}</p>
                  <p className="text-sm text-orange-600">
                    {reward.carrot_cost} 🥕{reward.is_active ? "" : " · inactive"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    resetErrors();
                    setEditing({ id: reward.id, name: reward.name, carrot_cost: String(reward.carrot_cost) });
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    resetErrors();
                    update.mutate({ id: reward.id, data: { is_active: !reward.is_active } });
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {reward.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    resetErrors();
                    remove.mutate(reward.id);
                  }}
                  className="text-sm text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
