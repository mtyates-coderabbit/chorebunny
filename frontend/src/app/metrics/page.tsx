import Link from "next/link";
import { ChoreBunnyLogo } from "@/components/ChoreBunnyLogo";
import { MetricsView } from "@/components/MetricsView";

/** Render the metrics dashboard with links to routines and task management. */
export default function MetricsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <ChoreBunnyLogo size="sm" />
        <div className="flex gap-2">
          <Link
            href="/"
            className="text-sm font-semibold text-orange-400 hover:text-orange-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100"
          >
            ← Routines
          </Link>
          <Link
            href="/tasks"
            className="text-sm font-semibold text-gray-400 hover:text-gray-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100"
          >
            ⚙️ Tasks
          </Link>
        </div>
      </div>
      <MetricsView />
    </div>
  );
}
