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
      ? "bg-leaf text-ink"
      : detector === "preview"
        ? "bg-paper/20 text-paper"
        : "bg-gold text-ink";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {label}
      </span>
      {sample ? (
        <span className="rounded-full bg-dust px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink">
          Sample
        </span>
      ) : null}
    </span>
  );
}
