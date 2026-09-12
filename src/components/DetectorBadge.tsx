"use client";

type Props = {
  detector:
    | "gemini"
    | "grok"
    | "mock"
    | "preview"
    | "gemini+roboflow"
    | "grok+roboflow"
    | "ensemble"
    | "roboflow";
  sample?: boolean;
  /** True when "mock" isn't a deliberate mode but a real outage — must never read as calm. */
  degraded?: boolean;
};

export function DetectorBadge({ detector, sample, degraded }: Props) {
  // Quiet only for plain Gemini. Surface Grok / ensemble / RF so judges can see the stack.
  const label = degraded
    ? "Detection unavailable"
    : detector === "ensemble"
      ? "Gemini + Grok + CV"
      : detector === "gemini+roboflow"
        ? "Gemini+RF"
        : detector === "grok+roboflow"
          ? "Grok+RF"
          : detector === "roboflow"
            ? "Roboflow"
            : detector === "grok"
              ? "Grok"
              : detector === "mock"
                ? "Mock"
                : detector === "preview"
                  ? "Preview"
                  : null;
  const tone = degraded
    ? "bg-rose-500 text-white animate-pulse"
    : detector === "ensemble" || detector === "grok" || detector === "grok+roboflow"
      ? "bg-violet-400 text-black"
      : detector === "gemini+roboflow" || detector === "roboflow"
        ? "bg-sky-400 text-black"
        : "bg-amber-400 text-black";

  if (!label && !sample) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {label ? (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
          {label}
        </span>
      ) : null}
      {sample ? (
        <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
          Sample
        </span>
      ) : null}
    </span>
  );
}
