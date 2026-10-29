"use client";

import { useBalance } from "@/hooks/useBalance";
import { useRedemptions, useRequestRedemption } from "@/hooks/useRedemptions";
import { useRewards } from "@/hooks/useRewards";

interface Props {
  childId: number;
}

/** Child-facing list of active rewards to request, plus the status of their pending and denied requests. */
export function RewardsPanel({ childId }: Props) {
  const { data: rewards = [], isError: rewardsError } = useRewards(true);
  const { data: balance } = useBalance(childId);
  const { data: requests = [] } = useRedemptions(childId);
  const request = useRequestRedemption(childId);

  const pending = requests.filter((r) => r.status === "pending");
  const pendingRewardIds = new Set(pending.map((r) => r.reward_id));
  const activeRewardIds = new Set(rewards.map((r) => r.id));
  const orphanedPending = pending.filter((r) => r.reward_id === null || !activeRewardIds.has(r.reward_id));
  const denied = requests.filter((r) => r.status === "denied");

  if (!rewardsError && rewards.length === 0 && denied.length === 0 && orphanedPending.length === 0) return null;

  return (
    <section className="px-5 pb-8 space-y-3">
      <h2 className="text-lg font-extrabold text-gray-800">🎁 Rewards</h2>
      {denied.map((r) => (
        <p key={r.id} className="text-sm text-gray-500 bg-white rounded-xl px-3 py-2 border border-gray-100">
          Not this time: {r.reward_name}
        </p>
      ))}
      {orphanedPending.map((r) => (
        <p key={r.id} className="text-sm text-gray-500 bg-white rounded-xl px-3 py-2 border border-gray-100">
          Waiting for a grown-up: {r.reward_name}
        </p>
      ))}
      {rewardsError && (
        <p role="alert" className="text-sm text-red-500">
          Couldn&apos;t load rewards. Try again in a moment.
        </p>
      )}
      {request.isError && (
        <p role="alert" className="text-sm text-red-500">
          Couldn&apos;t send that request. Try again!
        </p>
      )}
      {rewards.map((reward) => {
        const isPending = pendingRewardIds.has(reward.id);
        const canAfford = balance !== undefined && reward.carrot_cost <= balance.current_balance;
        return (
          <div key={reward.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-orange-100">
            <div className="flex-1">
              <p className="font-bold text-gray-800">{reward.name}</p>
              <p className="text-sm text-orange-600">{reward.carrot_cost} 🥕</p>
            </div>
            <button
              aria-label={`${isPending ? "Waiting for a grown-up" : "Ask for"} ${reward.name}`}
              disabled={isPending || !canAfford || request.isPending}
              onClick={() => request.mutate(reward.id)}
              className="bg-orange-500 text-white font-bold text-sm rounded-xl px-3 py-1.5 disabled:opacity-40"
            >
              {isPending ? "Waiting for a grown-up" : "Ask for it"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
