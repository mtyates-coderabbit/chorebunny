"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect to morning or evening based on the configured cutoff hour (default: noon). */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    /** Replace the current route with morning before the local cutoff hour, or evening otherwise. */
    const redirect = (cutoff: number) => {
      const hour = new Date().getHours();
      router.replace(hour < cutoff ? "/morning" : "/evening");
    };

    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => redirect(s.morning_cutoff_hour ?? 12))
      .catch(() => redirect(12));
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF8F0" }}>
      <div className="text-4xl animate-bounce">🐰</div>
    </div>
  );
}
