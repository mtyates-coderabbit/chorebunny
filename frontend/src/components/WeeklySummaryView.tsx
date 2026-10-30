"use client";

import { useMemo, useState } from "react";
import { useChildren } from "@/hooks/useChildren";
import { useRangeSummary } from "@/hooks/useRangeSummary";
import { useStreaks } from "@/hooks/useStreaks";
import { formatLocalDate } from "@/lib/dates";

/** Shift a local calendar date back by n days and format it as YYYY-MM-DD. */
function daysAgo(n: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return formatLocalDate(d);
}

/** Format a YYYY-MM-DD date at local midnight as a short weekday (e.g. "Mon"). */
function formatWeekday(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(dateStr + "T00:00:00"));
}

/** Format a YYYY-MM-DD date at local midnight as an en-US short month and day. */
function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(dateStr + "T00:00:00"));
}

/**
 * Show one child's most recent 7-day window: carrots earned per day, the
 * week's total, current streak, and the most/least completed tasks. A
 * child must be selected first; there is no household aggregate view.
 */
export function WeeklySummaryView() {
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const { data: children = [] } = useChildren();

  const now = new Date();
  const end = formatLocalDate(now);
  const start = daysAgo(6, now);

  const { data: range, isLoading, isError } = useRangeSummary(
    start, end, activeChildId ?? undefined, activeChildId !== null
  );
  const { data: streak } = useStreaks(undefined, activeChildId ?? undefined);

  const weekTotal = useMemo(
    () => range?.days.reduce((sum, d) => sum + d.earned_carrots, 0) ?? 0,
    [range]
  );
  const mostCompleted = useMemo(
    () => (range ? [...range.task_stats].filter((t) => t.count > 0).sort((a, b) => b.count - a.count).slice(0, 3) : []),
    [range]
  );
  const leastCompleted = useMemo(() => {
    if (!range) return [];
    const topIds = new Set(mostCompleted.map((t) => t.task_id));
    return [...range.task_stats].filter((t) => !topIds.has(t.task_id)).sort((a, b) => a.count - b.count).slice(0, 3);
  }, [range, mostCompleted]);

  return (
    <div className="px-5 pb-10">
      {children.length === 0 ? (
        <p className="text-center py-10 text-gray-400">
          Add a child in Settings to see a weekly summary.
        </p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap mb-5">
            {children.map((child) => (
              <button
                key={child.id}
                aria-pressed={activeChildId === child.id}
                onClick={() => setActiveChildId(child.id)}
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
              <p className="font-semibold text-base">Select a child to see their weekly summary</p>
            </div>
          ) : isLoading ? (
            <div className="px-5 py-10 text-center text-gray-400 font-semibold">Loading weekly summary...</div>
          ) : isError ? (
            <div role="alert" className="px-5 py-10 text-center text-gray-400 font-semibold">
              Unable to load weekly summary. Please try again.
            </div>
          ) : (
            <>
              <h2 className="text-base font-semibold mb-1" style={{ color: "#3D2B1F" }}>
                {formatShortDate(start)} – {formatShortDate(end)}
              </h2>
              <div className="flex gap-3 mb-6">
                <div className="flex-1 bg-white rounded-2xl p-4 border text-center" style={{ borderColor: "#F0E8DC" }}>
                  <p className="text-2xl font-extrabold text-orange-500">{weekTotal} 🥕</p>
                  <p className="text-xs text-gray-400 mt-1">earned this week</p>
                </div>
                <div className="flex-1 bg-white rounded-2xl p-4 border text-center" style={{ borderColor: "#F0E8DC" }}>
                  <p className="text-2xl font-extrabold" style={{ color: "#F97316" }}>
                    🔥 {streak?.current_streak ?? 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">day streak</p>
                </div>
              </div>

              <section className="mb-8">
                <h3 className="text-sm font-semibold mb-3" style={{ color: "#3D2B1F" }}>
                  Carrots per day
                </h3>
                <div className="bg-white rounded-2xl p-4 border flex justify-between" style={{ borderColor: "#F0E8DC" }}>
                  {(range?.days ?? []).map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-400">{formatWeekday(day.date)}</span>
                      <span
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: day.earned_carrots > 0 ? "#F97316" : "#E5E7EB" }}
                      >
                        {day.earned_carrots}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: "#F0E8DC" }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "#3D2B1F" }}>Top chores</h3>
                  {mostCompleted.length === 0 ? (
                    <p className="text-xs text-gray-400">No completions yet this week.</p>
                  ) : (
                    <ul className="text-sm text-gray-600 flex flex-col gap-1">
                      {mostCompleted.map((t) => (
                        <li key={t.task_id}>{t.name} · {t.count}×</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: "#F0E8DC" }}>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: "#3D2B1F" }}>Needs attention</h3>
                  {leastCompleted.length === 0 ? (
                    <p className="text-xs text-gray-400">No tasks yet.</p>
                  ) : (
                    <ul className="text-sm text-gray-600 flex flex-col gap-1">
                      {leastCompleted.map((t) => (
                        <li key={t.task_id}>{t.name} · {t.count}×</li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
