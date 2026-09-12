type Props = {
  tone?: "light" | "dark";
  size?: "sm" | "md";
  align?: "start" | "center";
  className?: string;
};

export function BrandLockup({ tone = "light", size = "sm", align = "start", className = "" }: Props) {
  const mark = size === "md" ? "h-12 w-12 rounded-xl" : "h-8 w-8 rounded-lg";
  const text = size === "md" ? "text-2xl font-semibold tracking-tight" : "text-sm font-medium tracking-tight";
  const color = tone === "dark" ? "text-white" : "text-slate-900";
  const row = align === "center" ? "flex-col items-center" : "items-center";

  return (
    <div className={`flex gap-2 ${row} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark-house-on-emerald.png" alt="" className={mark} />
      <span className={`${text} ${color}`}>cribCheck</span>
    </div>
  );
}
