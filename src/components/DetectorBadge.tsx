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

function isModelDetector(detector: Props["detector"]) {
  return detector !== "mock" && detector !== "preview";
}

export function DetectorBadge({ detector, sample, degraded }: Props) {
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
              : detector === "gemini"
                ? "Gemini"
                : detector === "mock" || detector === "preview"
                  ? "No model run"
                  : null;

  const prominent = degraded || (label && isModelDetector(detector));
  const tone = degraded
    ? "bg-rose-600 text-white animate-pulse"
    : prominent
      ? "bg-sky-600 text-white"
      : "border border-slate-300 bg-transparent text-[9px] text-slate-500";

  if (!label && !sample) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      {label ? (
        <span
          className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider ${
            prominent ? "text-[10px]" : "text-[9px]"
          } ${tone}`}
        >
          {label}
        </span>
      ) : null}
      {sample ? (
        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          Sample
        </span>
      ) : null}
    </span>
  );
}
