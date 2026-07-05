import { cn } from "../../lib/utils";

type ThreadsBackgroundProps = {
  className?: string;
  reducedMotion?: boolean;
};

const lineSets = [
  "M-120 140 C160 40 240 280 520 160 S920 -20 1180 170",
  "M-100 260 C110 150 340 380 560 240 S880 80 1180 300",
  "M-80 390 C210 290 330 530 620 370 S930 210 1200 430",
  "M-140 510 C140 440 380 650 640 500 S930 350 1210 590",
];

const animationDelayClasses = [
  "[animation-delay:0s]",
  "[animation-delay:0.7s]",
  "[animation-delay:1.4s]",
  "[animation-delay:2.1s]",
];

export function ThreadsBackground({
  className,
  reducedMotion = false,
}: ThreadsBackgroundProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(44,123,229,0.16),transparent_34%),radial-gradient(circle_at_78%_12%,rgba(246,178,107,0.14),transparent_30%),radial-gradient(circle_at_54%_78%,rgba(52,168,83,0.12),transparent_36%)]" />
      <svg
        className={cn(
          "absolute left-1/2 top-1/2 h-[120%] min-h-[760px] w-[150%] min-w-[1200px] -translate-x-1/2 -translate-y-1/2 opacity-55",
          !reducedMotion && "animate-[vsa-threads-drift_18s_ease-in-out_infinite]",
        )}
        viewBox="0 0 1080 720"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {lineSets.map((path, index) => (
          <path
            d={path}
            key={path}
            className={cn(
              index % 2 === 0 ? "stroke-brand-400/55" : "stroke-red-300/45",
              !reducedMotion &&
                "animate-[vsa-threads-pulse_6s_ease-in-out_infinite]",
              animationDelayClasses[index],
            )}
            strokeWidth={index === 1 ? 18 : 12}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--surface)_0%,transparent_22%,transparent_78%,var(--surface)_100%)]" />
    </div>
  );
}
