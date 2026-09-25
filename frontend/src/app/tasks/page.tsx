import Link from "next/link";
import { TaskManager } from "@/components/TaskManager";

export default function TasksPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      <div className="px-5 pt-5">
        <Link
          href="/"
          className="inline-block text-sm font-semibold text-orange-400 hover:text-orange-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100 mb-2"
        >
          ← Back to routines
        </Link>
      </div>
      <TaskManager />
    </div>
  );
}
