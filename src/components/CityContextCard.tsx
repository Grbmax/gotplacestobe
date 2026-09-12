import { civicCompactLine } from "@/lib/labels";
import type { CityContext } from "@/lib/types";

export function CityContextCard({
  context,
  compact = false,
}: {
  context?: CityContext;
  compact?: boolean;
}) {
  if (!compact) return null;

  return (
    <p className="mt-2 inline-block rounded-full bg-sky-50 px-2.5 py-1 text-[11px] leading-snug text-sky-900">
      {civicCompactLine(context)}
    </p>
  );
}
