"use client";

import { useState } from "react";
import { useAchievements } from "@/hooks/useAchievements";
import { useChildren } from "@/hooks/useChildren";
import type { AchievementStatus } from "@/lib/types";

/** Format an ISO datetime as an en-US short month, day, and year. */
function formatUnlockDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

/**
 * Show every seeded achievement as a badge grid for the selected child: unlocked
 * badges are full color with their unlock date, locked ones are greyscale
 * silhouettes with no date. Tapping an unlocked badge reveals its description
 * and unlock date; tapping a locked badge never reveals its unlock criteria.
 */
export function AchievementsView() {
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [selected, setSelected] = useState<AchievementStatus | null>(null);
  const {
    data: children = [],
    isPending: childrenPending,
    isError: childrenError,
    refetch: refetchChildren,
  } = useChildren();
  const { data: achievementsList = [], isLoading, isError } = useAchievements(activeChildId ?? undefined);

  return (
    <div className="px-5 pb-10">
      {childrenPending ? (
        <p role="status" className="text-center py-10 text-gray-400">Loading children...</p>
      ) : childrenError ? (
        <div role="alert" className="text-center py-10 text-gray-400">
          <p>Unable to load children. Please try again.</p>
          <button onClick={() => void refetchChildren()} className="mt-2 px-3 py-1.5 rounded-xl border border-orange-300 text-orange-500 font-semibold">
            Retry
          </button>
        </div>
      ) : children.length === 0 ? (
        <p className="text-center py-10 text-gray-400">
          Add a child in Settings to see their achievements.
        </p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-5">
            {children.map((child) => (
              <button
                key={child.id}
                aria-pressed={activeChildId === child.id}
                onClick={() => { setActiveChildId(child.id); setSelected(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-colors ${
                  activeChildId === child.id
                    ? "text-white border-transparent"
                    : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                }`}
                style={activeChildId === child.id ? { background: child.color, borderColor: child.color } : undefined}
              >
                <span>{child.avatar}</span>
                {child.name}
              </button>
            ))}
          </div>

          {activeChildId === null ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">👆</p>
              <p className="font-semibold text-base">Select a child to see their achievements</p>
            </div>
          ) : isLoading ? (
            <div className="px-5 py-10 text-center text-gray-400 font-semibold">Loading achievements...</div>
          ) : isError ? (
            <div role="alert" className="px-5 py-10 text-center text-gray-400 font-semibold">
              Unable to load achievements. Please try again.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3" role="list">
              {achievementsList.map((achievement) => (
                <button
                  key={achievement.id}
                  role="listitem"
                  aria-label={achievement.unlocked ? `${achievement.name}, unlocked` : `${achievement.name}, locked`}
                  onClick={() => { if (achievement.unlocked) setSelected(achievement); }}
                  className={`flex flex-col items-center gap-1 bg-white rounded-2xl p-3 border text-center ${
                    achievement.unlocked ? "" : "cursor-default"
                  }`}
                  style={{ borderColor: achievement.unlocked ? "#F97316" : "#F0E8DC" }}
                >
                  <span className={`text-3xl ${achievement.unlocked ? "" : "grayscale opacity-40"}`}>
                    {achievement.icon}
                  </span>
                  <span className="text-xs font-semibold text-gray-700">{achievement.name}</span>
                  {achievement.unlocked && achievement.unlocked_at ? (
                    <span className="text-[11px] text-gray-400">{formatUnlockDate(achievement.unlocked_at)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selected && (
        <div
          role="dialog"
          aria-label={selected.name}
          className="fixed inset-0 bg-black/40 flex items-center justify-center px-5 z-50"
          onClick={() => setSelected(null)}
        >
          <div className="bg-white rounded-2xl p-6 max-w-xs text-center shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-5xl mb-2">{selected.icon}</p>
            <h2 className="text-lg font-extrabold text-gray-800">{selected.name}</h2>
            <p className="text-sm text-gray-500 mt-1">{selected.description}</p>
            {selected.unlocked_at && (
              <p className="text-xs text-gray-400 mt-2">Unlocked {formatUnlockDate(selected.unlocked_at)}</p>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-4 bg-orange-500 text-white font-bold text-sm rounded-xl px-4 py-1.5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
