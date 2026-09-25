"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hour = new Date().getHours();
    router.replace(hour < 12 ? "/morning" : "/evening");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF8F0" }}>
      <div className="text-4xl animate-bounce">🐰</div>
    </div>
  );
}
