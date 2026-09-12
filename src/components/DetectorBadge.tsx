"use client";

type Props = {
  detector: "gemini" | "mock" | "preview";
  sample?: boolean;
};

export function DetectorBadge({ detector, sample }: Props) {
  const showDetector = detector === "mock";
  if (!showDetector && !sample) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {showDetector ? (
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
          Mock
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
