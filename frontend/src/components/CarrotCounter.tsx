interface Props {
  earned: number;
  total: number;
}

export function CarrotCounter({ earned, total }: Props) {
  const useIcons = total <= 15;

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {useIcons ? (
        <div className="flex flex-wrap justify-center gap-1 max-w-xs">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`text-2xl transition-all duration-500 ${
                i < earned ? "opacity-100 scale-110" : "opacity-20 grayscale"
              }`}
            >
              🥕
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-2 shadow-sm border border-orange-100">
          <span className="text-3xl">🥕</span>
          <div>
            <div className="h-3 bg-orange-100 rounded-full w-32 overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all duration-500"
                style={{ width: total > 0 ? `${(earned / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        </div>
      )}
      <p className="text-sm font-semibold text-orange-600">
        {earned} / {total} carrots earned
      </p>
    </div>
  );
}
