"use client";

import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { useRangeSummary } from "@/hooks/useRangeSummary";
import { useTasks } from "@/hooks/useTasks";
import type { DayCarrots } from "@/lib/types";

/**
 * Shift the current local calendar date back by n days, then return its UTC
 * date as YYYY-MM-DD. Throws RangeError if the resulting date is invalid.
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/** Return the current UTC date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Color carrot totals gray when either is zero, green at 100% or above,
 * orange at 50% or above, and pale orange otherwise.
 */
function heatColor(earned: number, total: number): string {
  if (total === 0 || earned === 0) return "#E5E7EB";
  const pct = earned / total;
  if (pct >= 1)   return "#4ADE80";
  if (pct >= 0.5) return "#F97316";
  return "#FED7AA";
}

/**
 * Format a YYYY-MM-DD date at local midnight as an en-US short month and day.
 * Throws RangeError if the constructed date is invalid.
 */
function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(dateStr + "T00:00:00")
  );
}

/**
 * Return the en-US short month for a YYYY-MM-DD date interpreted locally.
 * Throws RangeError if the constructed date is invalid.
 */
function formatMonth(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(dateStr + "T00:00:00")
  );
}

interface HeatmapProps {
  days: DayCarrots[];
}

/**
 * Render carrot totals with hover details in seven-entry columns, preserving
 * input order without padding missing dates or aligning the first weekday.
 */
function Heatmap({ days }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ day: DayCarrots; x: number; y: number } | null>(null);

  const weeks: DayCarrots[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = "";
    weeks.forEach((week, col) => {
      const month = formatMonth(week[0].date);
      if (month !== lastMonth) {
        labels.push({ label: month, col });
        lastMonth = month;
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div style={{ position: "relative" }}>
      {/* Month labels */}
      <div style={{ display: "flex", paddingLeft: 28, marginBottom: 4 }}>
        {weeks.map((_, col) => {
          const label = monthLabels.find((m) => m.col === col);
          return (
            <div key={col} style={{ width: 14, marginRight: 2, fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>
              {label ? label.label : ""}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 0 }}>
        {/* Day-of-week labels */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: 4, paddingTop: 1 }}>
          {["S","M","T","W","T","F","S"].map((d, i) => (
            <div key={i} style={{ height: 12, fontSize: 9, color: "var(--text-muted)", lineHeight: "12px" }}>{i % 2 === 1 ? d : ""}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: "flex", gap: 2 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {week.map((day) => (
                <div
                  key={day.date}
                  onMouseEnter={(e) => setTooltip({ day, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: heatColor(day.earned_carrots, day.total_carrots),
                    cursor: "default",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span>None</span>
        {["#E5E7EB","#FED7AA","#F97316","#4ADE80"].map((c) => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
        ))}
        <span>All done</span>
      </div>

      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.x + 10,
          top: tooltip.y - 36,
          background: "var(--surface-2)",
          border: "0.5px solid var(--border)",
          borderRadius: 6,
          padding: "4px 8px",
          fontSize: 12,
          color: "var(--text-primary)",
          pointerEvents: "none",
          zIndex: 50,
          whiteSpace: "nowrap",
        }}>
          {formatShortDate(tooltip.day.date)} — {tooltip.day.earned_carrots}/{tooltip.day.total_carrots} 🥕
        </div>
      )}
    </div>
  );
}

/**
 * Load a 90-day carrot calendar and show trends for its last 30 days.
 * Each trend divides combined earned carrots by the current routine total
 * (zero when that total is zero); task bars currently use zero counts.
 */
export function MetricsView() {
  const end = today();
  const start90 = daysAgo(89);
  const start30 = daysAgo(29);

  const { data: range90, isLoading: loading90 } = useRangeSummary(start90, end);
  const { data: morningTasks = [] } = useTasks("morning");
  const { data: eveningTasks = [] } = useTasks("evening");

  const trendData = useMemo(() => {
    if (!range90) return [];
    const mTotal = morningTasks.reduce((s, t) => s + t.carrot_value, 0);
    const eTotal = eveningTasks.reduce((s, t) => s + t.carrot_value, 0);
    return range90.days.slice(-30).map((d) => ({
      date: formatShortDate(d.date),
      morning: mTotal > 0 ? Math.round((d.earned_carrots / mTotal) * 100) : 0,
      evening: eTotal > 0 ? Math.round((d.earned_carrots / eTotal) * 100) : 0,
    }));
  }, [range90, morningTasks, eveningTasks]);

  const allTasks = [...morningTasks, ...eveningTasks];
  const taskCompletionCounts = useMemo(() => {
    if (!range90) return [];
    const countByTask: Record<number, { name: string; routine: string; count: number }> = {};
    allTasks.forEach((t) => { countByTask[t.id] = { name: t.name, routine: t.routine, count: 0 }; });
    return Object.values(countByTask).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [range90, allTasks]);

  if (loading90) {
    return <div className="px-5 py-10 text-center text-gray-400 font-semibold">Loading metrics...</div>;
  }

  return (
    <div className="px-5 pb-10">
      {/* Heatmap */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3" style={{ color: "#3D2B1F" }}>
          90-day completion calendar
        </h2>
        <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: "#F0E8DC" }}>
          {range90 && <Heatmap days={range90.days} />}
        </div>
      </section>

      {/* Trend lines */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3" style={{ color: "#3D2B1F" }}>
          30-day completion trend
        </h2>
        <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: "#F0E8DC" }}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DC"/>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }}/>
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="morning" stroke="#F97316" strokeWidth={2} dot={false} name="Morning"/>
              <Line type="monotone" dataKey="evening" stroke="#7DD3FC" strokeWidth={2} dot={false} name="Evening"/>
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center" style={{ fontSize: 12 }}>
            <span style={{ color: "#F97316" }}>— Morning</span>
            <span style={{ color: "#7DD3FC" }}>— Evening</span>
          </div>
        </div>
      </section>

      {/* Top tasks */}
      <section>
        <h2 className="text-base font-semibold mb-3" style={{ color: "#3D2B1F" }}>
          Tasks (90 days)
        </h2>
        <div className="bg-white rounded-2xl p-4 border" style={{ borderColor: "#F0E8DC" }}>
          {taskCompletionCounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Complete some tasks to see stats here.</p>
          ) : (
            <ResponsiveContainer width="100%" height={taskCompletionCounts.length * 36 + 16}>
              <BarChart
                layout="vertical"
                data={taskCompletionCounts}
                margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false}/>
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(v: number) => [`${v} completions`]}/>
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {taskCompletionCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.routine === "morning" ? "#F97316" : "#7DD3FC"}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-center" style={{ fontSize: 12 }}>
            <span style={{ color: "#F97316" }}>■ Morning</span>
            <span style={{ color: "#7DD3FC" }}>■ Evening</span>
          </div>
        </div>
      </section>
    </div>
  );
}
