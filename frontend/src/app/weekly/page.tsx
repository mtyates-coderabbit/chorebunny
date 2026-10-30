import Link from "next/link";
import { ChoreBunnyLogo } from "@/components/ChoreBunnyLogo";
import { WeeklySummaryView } from "@/components/WeeklySummaryView";

/** Render the weekly summary page with links back to routines and metrics. */
export default function WeeklyPage() {
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
            href="/metrics"
            className="text-sm font-semibold text-gray-400 hover:text-gray-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100"
          >
            📊 Metrics
          </Link>
        </div>
      </div>
      <WeeklySummaryView />
    </div>
  );
}
