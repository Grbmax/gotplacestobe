"use client";

type Props = {
  detector: "gemini" | "mock" | "preview";
  sample?: boolean;
};

export function DetectorBadge({ detector, sample }: Props) {
  const label =
    detector === "gemini" ? "Gemini" : detector === "preview" ? "Preview" : "Mock";
  const tone =
    detector === "gemini"
      ? "bg-emerald-400 text-black"
      : detector === "preview"
        ? "bg-white/20 text-white"
        : "bg-amber-400 text-black";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {label}
      </span>
      {sample ? (
        <span className="rounded-full bg-violet-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black">
          Sample
        </span>
      ) : null}
    </span>
  );
}
