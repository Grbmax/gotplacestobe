"use client";

type Props = {
  detector: "gemini" | "mock" | "preview" | "gemini+roboflow" | "roboflow";
  sample?: boolean;
};

export function DetectorBadge({ detector, sample }: Props) {
  // Quiet by default (match recent UI): hide Gemini/Preview. Surface Mock + RF paths.
  const label =
    detector === "gemini+roboflow"
      ? "Gemini+RF"
      : detector === "roboflow"
        ? "Roboflow"
        : detector === "mock"
          ? "Mock"
          : null;
  const tone =
    detector === "gemini+roboflow" || detector === "roboflow"
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
