"use client";

import { useEffect, useRef } from "react";

interface Props {
  earned: number;
  total: number;
  onDismiss: () => void;
}

export function CelebrationOverlay({ earned, total, onDismiss }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    import("canvas-confetti").then(({ default: confetti }) => {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["#F97316", "#4ADE80", "#7DD3FC", "#F472B6", "#FACC15"],
      });
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#F97316", "#4ADE80", "#7DD3FC"],
        });
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#F97316", "#4ADE80", "#7DD3FC"],
        });
      }, 300);
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="bg-white rounded-3xl p-10 mx-6 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-7xl animate-bounce">🥕</div>
        <h2 className="text-3xl font-extrabold text-orange-500 text-center">
          Amazing job!
        </h2>
        <p className="text-xl font-bold text-gray-700 text-center">
          You earned{" "}
          <span className="text-orange-500">{earned}</span> out of{" "}
          <span className="text-gray-500">{total}</span> carrots!
        </p>
        <p className="text-gray-400 text-center text-sm">
          The bunny is so proud of you 🐰
        </p>
        <button
          onClick={onDismiss}
          className="mt-2 bg-orange-400 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-2xl text-lg transition-colors active:scale-95"
        >
          Woohoo! 🎉
        </button>
      </div>
    </div>
  );
}
