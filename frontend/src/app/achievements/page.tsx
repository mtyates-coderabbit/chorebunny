import Link from "next/link";
import { AchievementsView } from "@/components/AchievementsView";
import { ChoreBunnyLogo } from "@/components/ChoreBunnyLogo";

/** Render the achievements page with a link back to the routines view. */
export default function AchievementsPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FFF8F0" }}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <ChoreBunnyLogo size="sm" />
        <Link
          href="/"
          className="text-sm font-semibold text-orange-400 hover:text-orange-600 bg-white rounded-xl px-3 py-2 shadow-sm border border-orange-100"
        >
          ← Routines
        </Link>
      </div>
      <h1 className="px-5 pb-2 text-2xl font-extrabold text-gray-800">🏅 Achievements</h1>
      <AchievementsView />
    </div>
  );
}
