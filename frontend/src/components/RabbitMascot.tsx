interface Props {
  percent: number;
}

function getMood(percent: number) {
  if (percent === 0) return "sleepy";
  if (percent <= 25) return "waking";
  if (percent <= 50) return "happy";
  if (percent < 100) return "excited";
  return "celebrating";
}

export function RabbitMascot({ percent }: Props) {
  const mood = getMood(percent);

  const eyeStyle =
    mood === "sleepy"
      ? "M11 16 Q12 15 13 16" // closed eyes
      : mood === "celebrating"
      ? "M11 15 Q12 13 13 15" // big happy eyes
      : "M11 15.5 Q12 14 13 15.5";

  const mouthStyle =
    mood === "sleepy"
      ? "M11 19 Q12 19 13 19" // flat
      : mood === "waking"
      ? "M11 19 Q12 19.5 13 19" // slight smile
      : "M11 19 Q12 21 13 19"; // big smile

  const earAnimClass =
    mood === "celebrating" ? "animate-bounce" : "";

  const bodyAnimClass =
    mood === "celebrating" ? "animate-bounce" : "";

  const blushOpacity =
    mood === "excited" || mood === "celebrating" ? "0.4" : "0";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 48 60"
        className={`w-28 h-28 ${bodyAnimClass}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left ear */}
        <ellipse
          cx="16"
          cy="10"
          rx="5"
          ry="12"
          fill="#f9d4e8"
          stroke="#e8aace"
          strokeWidth="1"
          className={earAnimClass}
        />
        <ellipse cx="16" cy="10" rx="2.5" ry="8" fill="#f7b8d8" />

        {/* Right ear */}
        <ellipse
          cx="32"
          cy="10"
          rx="5"
          ry="12"
          fill="#f9d4e8"
          stroke="#e8aace"
          strokeWidth="1"
          className={earAnimClass}
        />
        <ellipse cx="32" cy="10" rx="2.5" ry="8" fill="#f7b8d8" />

        {/* Body */}
        <ellipse cx="24" cy="44" rx="14" ry="12" fill="#fff0f8" stroke="#e8aace" strokeWidth="1" />

        {/* Head */}
        <ellipse cx="24" cy="24" rx="13" ry="13" fill="#fff0f8" stroke="#e8aace" strokeWidth="1" />

        {/* Blush */}
        <ellipse cx="17" cy="21" rx="3" ry="2" fill="#f472b6" opacity={blushOpacity} />
        <ellipse cx="31" cy="21" rx="3" ry="2" fill="#f472b6" opacity={blushOpacity} />

        {/* Eyes */}
        <path d={eyeStyle} stroke="#5b3f6b" strokeWidth="1.5" fill="none" strokeLinecap="round" />

        {/* Mouth */}
        <path d={mouthStyle} stroke="#e4789a" strokeWidth="1.2" fill="none" strokeLinecap="round" />

        {/* Nose */}
        <ellipse cx="12" cy="17" rx="1" ry="0.8" fill="#f472b6" />

        {/* Belly */}
        <ellipse cx="24" cy="44" rx="7" ry="6" fill="#ffe4f0" />

        {/* Paws */}
        <ellipse cx="14" cy="54" rx="5" ry="3" fill="#fff0f8" stroke="#e8aace" strokeWidth="1" />
        <ellipse cx="34" cy="54" rx="5" ry="3" fill="#fff0f8" stroke="#e8aace" strokeWidth="1" />

        {/* Stars for celebrating */}
        {mood === "celebrating" && (
          <>
            <text x="2" y="12" fontSize="6">⭐</text>
            <text x="38" y="12" fontSize="6">⭐</text>
          </>
        )}

        {/* Zzz for sleepy */}
        {mood === "sleepy" && (
          <text x="34" y="14" fontSize="7" fill="#a78bfa">z</text>
        )}
      </svg>
      <p className="text-sm font-semibold text-purple-400 mt-1">
        {mood === "sleepy" && "Still waking up..."}
        {mood === "waking" && "Getting started!"}
        {mood === "happy" && "Doing great!"}
        {mood === "excited" && "Almost there!"}
        {mood === "celebrating" && "Amazing job! 🎉"}
      </p>
    </div>
  );
}
