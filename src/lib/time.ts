/** Format scan timestamps for display — UTC stored, local rendered, no seconds. */
export function formatScanTime(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = now - t;
  if (diffMs >= 0 && diffMs < 86_400_000) {
    const mins = Math.round(diffMs / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
}

/** Human span between two ISO timestamps. */
export function formatTimeSpan(firstIso: string, latestIso: string): string {
  const a = new Date(firstIso).getTime();
  const b = new Date(latestIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  const mins = Math.round(Math.abs(b - a) / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} apart`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} apart`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} apart`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} week${weeks === 1 ? "" : "s"} apart`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} apart`;
}
