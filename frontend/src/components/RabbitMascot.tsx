"use client";

interface Props {
  percent: number;
}

type Mood = "sleepy" | "waking" | "happy" | "excited" | "celebrating";

/**
 * Map completion percentage to sleepy at zero, waking through 25, happy
 * through 50, excited below 100, and celebrating otherwise. Values are not
 * clamped: negative values are waking, and NaN falls through to celebrating.
 */
function getMood(percent: number): Mood {
  if (percent === 0) return "sleepy";
  if (percent <= 25) return "waking";
  if (percent <= 50) return "happy";
  if (percent < 100) return "excited";
  return "celebrating";
}

const MOODS: Record<Mood, { label: string; bodyAnim: string; earAnim: string }> = {
  sleepy:      { label: "Still waking up...",  bodyAnim: "breathe 3.2s ease-in-out infinite", earAnim: "none" },
  waking:      { label: "Getting started!",    bodyAnim: "none",                               earAnim: "earTwitch 3.5s ease-in-out infinite" },
  happy:       { label: "Doing great!",        bodyAnim: "sway 2.8s ease-in-out infinite",    earAnim: "none" },
  excited:     { label: "Almost there!",       bodyAnim: "rabbitBounce 0.75s ease-in-out infinite", earAnim: "none" },
  celebrating: { label: "Amazing job! 🎉",     bodyAnim: "rabbitBounce 0.48s ease-in-out infinite", earAnim: "earWave 0.9s ease-in-out infinite" },
};

/** Render an animated rabbit and encouragement for completion on a 0–100 scale. */
export function RabbitMascot({ percent }: Props) {
  const mood = getMood(percent);
  const { label, bodyAnim, earAnim } = MOODS[mood];
  const isSleepy = mood === "sleepy";
  const isWaking = mood === "waking";
  const showCheeks = mood === "excited" || mood === "celebrating";
  const isCelebrating = mood === "celebrating";

  const cheekAnim = isCelebrating
    ? "blush 0.5s ease-in-out infinite"
    : "blush 1s ease-in-out infinite";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 80 110"
        className="w-36 h-auto"
        style={{ overflow: "visible" }}
        aria-label={`Rabbit mascot: ${label}`}
      >
        {/* Floating Zzz (sleepy only) */}
        {isSleepy && (
          <g>
            <text x="54" y="22" fontSize="7" fill="#94A3B8" style={{ animation: "floatZ 2.4s ease-in-out infinite" }}>z</text>
            <text x="61" y="13" fontSize="11" fill="#94A3B8" style={{ animation: "floatZ 2.4s ease-in-out infinite 0.8s" }}>Z</text>
            <text x="69" y="6"  fontSize="7"  fill="#94A3B8" style={{ animation: "floatZ 2.4s ease-in-out infinite 1.5s" }}>z</text>
          </g>
        )}

        {/* Spinning stars (celebrating only) */}
        {isCelebrating && (
          <g>
            <text x="-2" y="22" fontSize="12" style={{ animation: "spinStar 1.3s ease-in-out infinite" }}>⭐</text>
            <text x="63" y="18" fontSize="9"  style={{ animation: "spinStar 1.3s ease-in-out infinite 0.35s" }}>✨</text>
            <text x="-4" y="60" fontSize="8"  style={{ animation: "spinStar 1.3s ease-in-out infinite 0.7s" }}>⭐</text>
            <text x="67" y="55" fontSize="9"  style={{ animation: "spinStar 1.3s ease-in-out infinite 1s" }}>✨</text>
          </g>
        )}

        {/* Ears */}
        <g style={{ animation: earAnim, transformOrigin: "27px 37px" }}>
          <ellipse cx="27" cy="18" rx="9" ry="21" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1.2"/>
          <ellipse cx="27" cy="19" rx="5.5" ry="15" fill="#FFB3C1"/>
        </g>
        <g style={{ animation: isCelebrating ? "earWave 0.9s ease-in-out infinite 0.45s" : earAnim.replace("infinite", "infinite 0.5s"), transformOrigin: "53px 37px" }}>
          <ellipse cx="53" cy="18" rx="9" ry="21" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1.2"/>
          <ellipse cx="53" cy="19" rx="5.5" ry="15" fill="#FFB3C1"/>
        </g>

        {/* Body group (animated) */}
        <g style={{ animation: bodyAnim, transformOrigin: mood === "happy" ? "40px 52px" : "40px 84px" }}>
          <ellipse cx="40" cy="84" rx="22" ry="19" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1.2"/>
          <ellipse cx="40" cy="86" rx="13"  ry="12" fill="#FFF8F0"/>
          <ellipse cx="59" cy="84" rx="6.5" ry="6"  fill="#fff"    stroke="#E8C9A0" strokeWidth="0.8"/>
          <ellipse cx="25" cy="98" rx="9.5" ry="5.5" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1"/>
          <ellipse cx="55" cy="98" rx="9.5" ry="5.5" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1"/>

          {/* Head */}
          <circle cx="40" cy="52" r="23" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1.2"/>

          {/* Cheeks */}
          {showCheeks && (
            <>
              <ellipse cx="24" cy="57" rx="8"   ry="5"   fill="#FFB3C1" style={{ animation: cheekAnim }}/>
              <ellipse cx="56" cy="57" rx="8"   ry="5"   fill="#FFB3C1" style={{ animation: cheekAnim, animationDelay: "0.15s" }}/>
            </>
          )}
          {isWaking && (
            <>
              <ellipse cx="24" cy="57" rx="7" ry="4.5" fill="#FFB3C1" opacity="0.2"/>
              <ellipse cx="56" cy="57" rx="7" ry="4.5" fill="#FFB3C1" opacity="0.2"/>
            </>
          )}

          {/* Eyes */}
          {isSleepy ? (
            <>
              <path d="M28,49 Q33,54 38,49" stroke="#3D2B1F" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              <path d="M42,49 Q47,54 52,49" stroke="#3D2B1F" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
            </>
          ) : isWaking ? (
            <>
              {/* left closed */}
              <path d="M28,49 Q33,54 38,49" stroke="#3D2B1F" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
              {/* right half-open */}
              <circle cx="47" cy="50" r="4.5" fill="#fff" stroke="#E8C9A0" strokeWidth="1.5"/>
              <circle cx="47" cy="51"  r="2"   fill="#3D2B1F"/>
              <circle cx="48" cy="49.5" r="0.8" fill="#fff"/>
              <path d="M42.5,47 Q47,44 51.5,47" stroke="#E8C9A0" strokeWidth="2" fill="#F8F0E8" strokeLinecap="round"/>
            </>
          ) : isCelebrating ? (
            <>
              <circle cx="33" cy="49" r="5.5" fill="#fff" stroke="#E8C9A0" strokeWidth="1.5"/>
              <circle cx="47" cy="49" r="5.5" fill="#fff" stroke="#E8C9A0" strokeWidth="1.5"/>
              <text x="33" y="52.5" fontSize="8" fill="#F97316" textAnchor="middle">★</text>
              <text x="47" y="52.5" fontSize="8" fill="#F97316" textAnchor="middle">★</text>
            </>
          ) : (
            <>
              <circle cx="33" cy="49" r={mood === "excited" ? 5.5 : 4.5} fill="#fff" stroke="#E8C9A0" strokeWidth="1.5"/>
              <circle cx="47" cy="49" r={mood === "excited" ? 5.5 : 4.5} fill="#fff" stroke="#E8C9A0" strokeWidth="1.5"/>
              <circle cx="33" cy="49.5" r={mood === "excited" ? 2.4 : 2} fill="#3D2B1F"/>
              <circle cx="47" cy="49.5" r={mood === "excited" ? 2.4 : 2} fill="#3D2B1F"/>
              <circle cx="34.4" cy="47.8" r={mood === "excited" ? 1.1 : 0.9} fill="#fff"/>
              <circle cx="48.4" cy="47.8" r={mood === "excited" ? 1.1 : 0.9} fill="#fff"/>
            </>
          )}

          {/* Nose — inverted triangle */}
          <path d="M37.5,55.5 L42.5,55.5 L40,59.5 Z" fill="#F4A0B0"/>

          {/* Mouth */}
          {isSleepy  && <path d="M35,62 Q40,64 45,62"    stroke="#E8967A" strokeWidth="1.3" fill="none" strokeLinecap="round"/>}
          {isWaking  && <path d="M34,62 Q40,67 46,62"    stroke="#E8967A" strokeWidth="1.3" fill="none" strokeLinecap="round"/>}
          {mood === "happy"       && <path d="M32,62 Q40,69 48,62"    stroke="#E8967A" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
          {mood === "excited"     && <path d="M30,62 Q40,72 50,62"    stroke="#E8967A" strokeWidth="1.6" fill="none" strokeLinecap="round"/>}
          {isCelebrating          && <path d="M29,63 Q40,75 51,63"    stroke="#E8967A" strokeWidth="1.7" fill="none" strokeLinecap="round"/>}

          {/* Whiskers */}
          <line x1="17" y1="54" x2="31" y2="56" stroke="#C4A882" strokeWidth="0.7" opacity="0.4"/>
          <line x1="17" y1="58" x2="31" y2="57" stroke="#C4A882" strokeWidth="0.7" opacity="0.4"/>
          <line x1="49" y1="56" x2="63" y2="54" stroke="#C4A882" strokeWidth="0.7" opacity="0.4"/>
          <line x1="49" y1="57" x2="63" y2="58" stroke="#C4A882" strokeWidth="0.7" opacity="0.4"/>
        </g>
      </svg>

      <p className="text-sm font-semibold mt-1" style={{ color: "#C4956A" }}>{label}</p>
    </div>
  );
}
