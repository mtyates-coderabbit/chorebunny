interface Props {
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { icon: 20, text: 15, sub: 0 },
  md: { icon: 28, text: 20, sub: 10 },
  lg: { icon: 36, text: 26, sub: 11 },
};

export function ChoreBunnyLogo({ size = "md" }: Props) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 28 32"
        width={s.icon}
        height={Math.round(s.icon * 1.14)}
        style={{ display: "block", flexShrink: 0 }}
        aria-hidden="true"
      >
        <ellipse cx="10" cy="9" rx="5" ry="11" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1"/>
        <ellipse cx="18" cy="9" rx="5" ry="11" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1"/>
        <ellipse cx="10" cy="9.5" rx="2.8" ry="7.5" fill="#FFB3C1"/>
        <ellipse cx="18" cy="9.5" rx="2.8" ry="7.5" fill="#FFB3C1"/>
        <circle cx="14" cy="22" r="9.5" fill="#F8F0E8" stroke="#E8C9A0" strokeWidth="1"/>
        <circle cx="11" cy="21" r="2.2" fill="#fff" stroke="#E8C9A0" strokeWidth="1"/>
        <circle cx="17" cy="21" r="2.2" fill="#fff" stroke="#E8C9A0" strokeWidth="1"/>
        <circle cx="11" cy="21.4" r="1" fill="#3D2B1F"/>
        <circle cx="17" cy="21.4" r="1" fill="#3D2B1F"/>
        <path d="M11.5,24.5 L14,26.5 L16.5,24.5 Z" fill="#F4A0B0"/>
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: s.text, fontWeight: 500 }}>
          <span style={{ color: "#3D2B1F" }}>Chore</span>
          <span style={{ color: "#F97316" }}>Bunny</span>
        </div>
        {size !== "sm" && s.sub > 0 && (
          <div style={{ fontSize: s.sub, color: "#C4956A", marginTop: 2 }}>
            morning &amp; evening routines
          </div>
        )}
      </div>
    </div>
  );
}
