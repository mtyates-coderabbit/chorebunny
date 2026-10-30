"use client";

import { useState } from "react";
import { useGoalMutations, useGoals } from "@/hooks/useGoals";

interface Props {
  childId: number;
}

/** Child-facing list of savings goals with progress bars, an add-goal form, and a complete action once fully funded. */
export function GoalsPanel({ childId }: Props) {
  const { data: goals = [], isError } = useGoals(childId);
  const { create, complete, remove } = useGoalMutations(childId);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetDollars = Number(target);
    if (!name.trim() || !(targetDollars > 0)) return;
    create.mutate(
      { name: name.trim(), target_dollars: targetDollars },
      { onSuccess: () => { setName(""); setTarget(""); } }
    );
  };

  return (
    <section className="px-5 pb-8 space-y-3">
      <h2 className="text-lg font-extrabold text-gray-800">🎯 Savings Goals</h2>

      {isError && (
        <p role="alert" className="text-sm text-red-500">
          Couldn&apos;t load goals. Try again in a moment.
        </p>
      )}

      {goals.length === 0 && !isError ? (
        <p className="text-sm text-gray-400 bg-white rounded-xl px-3 py-2 border border-gray-100">
          Set your first goal!
        </p>
      ) : (
        goals.map((goal) => {
          const isComplete = goal.completed_at !== null;
          return (
            <div
              key={goal.id}
              className={`bg-white rounded-2xl px-4 py-3 shadow-sm border ${isComplete ? "border-green-200" : "border-orange-100"}`}
            >
              <div className="flex items-center justify-between">
                <p className={`font-bold ${isComplete ? "text-green-600 line-through" : "text-gray-800"}`}>
                  {goal.name}
                </p>
                <p className="text-sm text-gray-500">${goal.target_dollars.toFixed(2)}</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${goal.progress_percent}%`, background: isComplete ? "#4ADE80" : "#F97316" }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-400">
                  ${goal.earned_dollars.toFixed(2)} of ${goal.target_dollars.toFixed(2)}
                </p>
                <div className="flex gap-2">
                  {!isComplete && goal.progress_percent >= 100 && (
                    <button
                      onClick={() => complete.mutate(goal.id)}
                      className="text-xs font-bold text-white bg-green-500 rounded-lg px-2 py-1"
                    >
                      Mark complete
                    </button>
                  )}
                  <button
                    aria-label={`Remove ${goal.name}`}
                    onClick={() => remove.mutate(goal.id)}
                    className="text-xs text-gray-400 underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Goal name"
          aria-label="Goal name"
          className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          type="number"
          min="0.01"
          step="0.01"
          placeholder="$ target"
          aria-label="Target dollar amount"
          className="w-24 rounded-xl border border-gray-200 px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="bg-orange-500 text-white font-bold text-sm rounded-xl px-3 py-1.5 disabled:opacity-40"
        >
          Add
        </button>
      </form>
      {create.isError && (
        <p role="alert" className="text-sm text-red-500">Couldn&apos;t add that goal. Try again!</p>
      )}
    </section>
  );
}
