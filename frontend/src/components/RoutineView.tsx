"use client";

import { useState } from "react";
import { formatLocalDate } from "@/lib/dates";
import Link from "next/link";
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

/**
 * Show the selected routine's tasks and carrot progress for the current local date.
 * Task clicks toggle completion; a successful final-task toggle triggers a
 * celebration at most once while this view remains mounted.
 */
export function RoutineView({ routine }: Props) {
  const date = formatLocalDate(new Date());
  const [celebrated, setCelebrated] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const { data: tasks = [], isLoading: tasksLoading } = useTasks(routine);
  const { data: completions = [], isLoading: completionsLoading } = useCompletions(date, routine);
  const toggle = useToggleCompletion(date);

  const completedIds = new Set(completions.map((c) => c.task_id));
  const completedCount = tasks.filter((t) => completedIds.has(t.id)).length;
  const totalCount = tasks.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const totalCarrots = tasks.reduce((s, t) => s + t.carrot_value, 0);
  const earnedCarrots = tasks
    .filter((t) => completedIds.has(t.id))
    .reduce((s, t) => s + t.carrot_value, 0);

  const isLoading = tasksLoading || completionsLoading;

  const handleToggle = (taskId: number) => {
    const wasCompleted = completedIds.has(taskId);
    toggle.mutate(
      { taskId },
      {
        onSuccess: () => {
          if (!wasCompleted && completedCount + 1 === totalCount && !celebrated) {
            setCelebrated(true);
            setShowCelebration(true);
          }
        },
      }
    );
  };

  const other = routine === "morning" ? "evening" : "morning";

  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      {showCelebration && (
        <CelebrationOverlay
          earned={earnedCarrots}
          total={totalCarrots}
          onDismiss={() => setShowCelebration(false)}
        />
      )}

      {/* Header */}
      <header className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between mb-3">
          <ChoreBunnyLogo size="sm" />
          <div className="flex gap-2">
            <Link
              href={`/${other}`}
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
        <p className="text-sm font-medium mt-0.5" style={{ color: "#C4956A" }}>
          {new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(date + "T00:00:00"))}
          {" · "}
          {completedCount}/{totalCount} done
        </p>
      </header>

      {/* Mascot + carrot counter */}
      <div className="px-5 py-2 flex flex-col items-center">
        <RabbitMascot percent={percent} />
        <CarrotCounter earned={earnedCarrots} total={totalCarrots} />
      </div>

      {/* Task list */}
      <main className="px-5 pb-8 flex flex-col gap-3">
        {isLoading ? (
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
