"use client";

import type { Task } from "@/lib/types";

interface Props {
  task: Task;
  isCompleted: boolean;
  onToggle: () => void;
  isPending?: boolean;
}

export function TaskCard({ task, isCompleted, onToggle, isPending }: Props) {
  return (
    <button
      onClick={onToggle}
      disabled={isPending}
      className={`w-full text-left rounded-2xl p-4 flex items-center gap-4 shadow-sm border-2 transition-all duration-300 active:scale-95 ${
        isCompleted
          ? "bg-green-100 border-green-300"
          : "bg-white border-orange-100 hover:border-orange-300"
      } ${isPending ? "opacity-60" : ""}`}
    >
      {/* Checkbox */}
      <div
        className={`w-8 h-8 rounded-full border-3 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
          isCompleted
            ? "bg-green-400 border-green-400"
            : "border-orange-300 bg-white"
        }`}
      >
        {isCompleted && (
          <svg
            className="w-5 h-5 text-white animate-pop"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Task name */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-bold text-lg leading-tight ${
            isCompleted ? "text-green-700 line-through" : "text-gray-800"
          }`}
        >
          {task.name}
        </p>
        {task.description && (
          <p className="text-sm text-gray-500 mt-0.5 truncate">{task.description}</p>
        )}
      </div>

      {/* Carrots */}
      <div className="flex gap-0.5 flex-shrink-0">
        {Array.from({ length: task.carrot_value }).map((_, i) => (
          <span
            key={i}
            className={`text-xl transition-all duration-300 ${
              isCompleted ? "opacity-100" : "opacity-30"
            }`}
          >
            🥕
          </span>
        ))}
      </div>
    </button>
  );
}
