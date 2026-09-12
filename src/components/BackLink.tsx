import Link from "next/link";

export function BackLink({
  href,
  children,
  tone = "light",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "light" | "overlay";
}) {
  const cls =
    tone === "overlay"
      ? "rounded-full bg-black/55 px-3 py-1.5 text-xs text-white"
      : "text-sm text-emerald-400";
  return (
    <Link href={href} className={`inline-flex items-center gap-1 ${cls}`}>
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}
