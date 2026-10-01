"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatLocalDate } from "@/lib/dates";
import Link from "next/link";
import { useChildren } from "@/hooks/useChildren";
import { useCompletions } from "@/hooks/useCompletions";
import { useTasks } from "@/hooks/useTasks";
import { useToggleCompletion } from "@/hooks/useToggleCompletion";
import { CarrotCounter } from "./CarrotCounter";
import { CelebrationOverlay } from "./CelebrationOverlay";
import { ChoreBunnyLogo } from "./ChoreBunnyLogo";
import { RabbitMascot } from "./RabbitMascot";
import { TaskCard } from "./TaskCard";

interface Props {
  routine: "morning" | "evening";
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

/**
 * Show the selected routine's tasks and carrot progress for the selected date.
 * Defaults to today; date can be changed via ?date=YYYY-MM-DD in the URL.
 * Task clicks toggle completion; a successful final-task toggle triggers a
 * celebration at most once for the selected date until another date is celebrated.
 */
export function RoutineView({ routine }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const today = formatLocalDate(new Date());
  const rawDate = params.get("date") ?? today;
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    && !rawDate.startsWith("0000")
    && formatLocalDate(new Date(rawDate + "T00:00:00")) === rawDate;
  const date = !isValidDate || rawDate > today ? today : rawDate;
  const isToday = date === today;

  const [celebratedDate, setCelebratedDate] = useState<string | null>(null);
  const [showCelebrationDate, setShowCelebrationDate] = useState<string | null>(null);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);

  const {
    data: children = [],
    isSuccess: childrenLoaded,
    isError: childrenError,
    refetch: retryChildren,
  } = useChildren();
  const needsChildSelection = childrenLoaded && children.length > 0 && activeChildId === null;
  const canShowProgress = childrenLoaded && !needsChildSelection;
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(routine);
  const { data: completions = [], isLoading: completionsLoading } = useCompletions(
    date,
    routine,
    activeChildId ?? undefined,
    canShowProgress
  );
  const toggle = useToggleCompletion(date, activeChildId ?? undefined);

  const completedIds = new Set(completions.map((c) => c.task_id));
  const completedCount = tasks.filter((t) => completedIds.has(t.id)).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalCarrots = tasks.reduce((s, t) => s + t.carrot_value, 0);
  const earnedCarrots = tasks
    .filter((t) => completedIds.has(t.id))
    .reduce((s, t) => s + t.carrot_value, 0);

  const isLoading = !childrenLoaded || tasksLoading || completionsLoading;

  const handleToggle = (taskId: number) => {
    const wasCompleted = completedIds.has(taskId);
    toggle.mutate(
      { taskId },
      {
        onSuccess: () => {
          if (!wasCompleted && completedCount + 1 === totalCount && celebratedDate !== date) {
            setCelebratedDate(date);
            setShowCelebrationDate(date);
          }
        },
      }
    );
  };

  const other = routine === "morning" ? "evening" : "morning";

  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      {showCelebrationDate === date && (
        <CelebrationOverlay
          earned={earnedCarrots}
          total={totalCarrots}
          onDismiss={() => setShowCelebrationDate(null)}
        />
      )}

      {/* Header */}
      <header className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between mb-3">
          <ChoreBunnyLogo size="sm" />
          <div className="flex gap-2">
            <Link
              href={`/${other}?date=${date}`}
              className="text-sm font-semibold text-orange-400 hover:text-orange-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100"
            >
              {other === "morning" ? "☀️" : "🌙"} {other}
            </Link>
            <Link
              href="/tasks"
              aria-label="Task settings"
              className="text-sm font-semibold text-gray-400 hover:text-gray-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100"
            >
              ⚙️
            </Link>
            <Link
              href="/metrics"
              aria-label="Metrics"
              className="text-sm font-semibold text-gray-400 hover:text-gray-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100"
            >
              📊
            </Link>
          </div>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800 capitalize">
          {routine === "morning" ? "☀️" : "🌙"} {routine} routine
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <button
            onClick={() => router.push(`/${routine}?date=${offsetDate(date, -1)}`)}
            className="text-orange-300 hover:text-orange-500 text-lg leading-none px-1"
            aria-label="Previous day"
          >
            ‹
          </button>
          <p className="text-sm font-medium" style={{ color: "#C4956A" }}>
            {isToday
              ? "Today"
              : new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(date + "T00:00:00"))}
            {canShowProgress && ` · ${completedCount}/${totalCount} done`}
          </p>
          <button
            onClick={() => router.push(`/${routine}?date=${offsetDate(date, 1)}`)}
            disabled={isToday}
            className="text-orange-300 hover:text-orange-500 text-lg leading-none px-1 disabled:opacity-20 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            ›
          </button>
        </div>
      </header>

      {/* Child switcher */}
      {children.length > 0 && (
        <div className="px-5 pb-1 flex gap-2 flex-wrap">
          {children.map((child) => (
            <button
              key={child.id}
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
      )}

      {/* Mascot + carrot counter */}
      {canShowProgress && (
        <div className="px-5 py-2 flex flex-col items-center">
          <RabbitMascot percent={percent} routine={routine} />
          <CarrotCounter earned={earnedCarrots} total={totalCarrots} />
        </div>
      )}

      {/* Task list */}
      <main className="px-5 pb-8 flex flex-col gap-3">
        {childrenError ? (
          <div role="alert" className="text-center py-10 text-gray-400">
            <p className="font-semibold text-base">Unable to load children. Please try again.</p>
            <button
              onClick={() => retryChildren()}
              className="mt-2 text-orange-400 underline"
            >
              Retry
            </button>
          </div>
        ) : needsChildSelection ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-3xl mb-2">👆</p>
            <p className="font-semibold text-base">Select a child to start</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-10 text-gray-400 text-lg font-semibold">
            Loading...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No tasks yet — add some in{" "}
            <Link href="/tasks" className="text-orange-400 underline">
              Settings
            </Link>
            !
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isCompleted={completedIds.has(task.id)}
              onToggle={() => handleToggle(task.id)}
              isPending={toggle.isPending}
            />
          ))
        )}
      </main>
    </div>
  );
}
