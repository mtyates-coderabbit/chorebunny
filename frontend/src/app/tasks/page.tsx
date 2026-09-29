import Link from "next/link";
import { ChildManager } from "@/components/ChildManager";
import { ChoreBunnyLogo } from "@/components/ChoreBunnyLogo";
import { TaskManager } from "@/components/TaskManager";

/** Render task management with links to routines and metrics. */
export default function TasksPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <ChoreBunnyLogo size="sm" />
        <div className="flex gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-orange-400 hover:text-orange-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100"
          >
            ← Routines
          </Link>
          <Link
            href="/metrics"
            className="text-sm font-semibold text-gray-400 hover:text-gray-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100"
          >
            📊 Metrics
          </Link>
        </div>
      </div>
      <ChildManager />
      <TaskManager />
    </div>
  );
}
