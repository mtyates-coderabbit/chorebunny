"use client";

import { useChildren } from "@/hooks/useChildren";
import { useRedemptions, useResolveRedemption } from "@/hooks/useRedemptions";

/** Parent admin queue of pending reward requests, grouped by child, with approve and deny actions. */
export function RedemptionQueue() {
  const { data: children = [] } = useChildren();
  const { data: pending = [], isLoading } = useRedemptions(undefined, "pending");
  const { approve, deny } = useResolveRedemption();

  if (isLoading || pending.length === 0) return null;

  const busy = approve.isPending || deny.isPending;

  return (
    <div className="max-w-2xl mx-auto px-6 pt-6 space-y-4">
      <h2 className="text-xl font-extrabold text-gray-800">🙋 Reward requests</h2>
      {children
        .filter((child) => pending.some((r) => r.child_id === child.id))
        .map((child) => (
          <div key={child.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
            <h3 className="font-bold text-gray-700">
              {child.avatar} {child.name}
            </h3>
            <ul className="space-y-2">
              {pending
                .filter((r) => r.child_id === child.id)
                .map((request) => (
                  <li key={request.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{request.reward_name}</p>
                      <p className="text-sm text-orange-600">{request.carrot_cost} 🥕</p>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => approve.mutate(request.id)}
                      className="bg-green-400 text-white font-bold text-sm rounded-xl px-3 py-1.5 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => deny.mutate(request.id)}
                      className="text-sm text-gray-500 rounded-xl px-3 py-1.5 border border-gray-200 disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      {(approve.isError || deny.isError) && (
        <p role="alert" className="text-sm text-red-500">
          Couldn&apos;t update that request — it may already be resolved or the balance is too low.
        </p>
      )}
    </div>
  );
}
