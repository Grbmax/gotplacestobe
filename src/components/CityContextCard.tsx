import type { CityContext } from "@/lib/types";
import { dashboardTiles } from "@/lib/dashboard";

export function CityContextCard({
  context,
  compact = false,
}: {
  context?: CityContext;
  compact?: boolean;
}) {
  if (!compact) return null;

  if (!context) {
    return <p className="mt-2 text-xs text-zinc-500">County records not pulled yet.</p>;
  }

  const { overall, tiles } = dashboardTiles(context, []);
  const around = tiles.find((t) => t.id === "around");
  const file = tiles.find((t) => t.id === "file");
  const paint = tiles.find((t) => t.id === "paint");
  const pill =
    overall === "rose"
      ? "text-rose-300"
      : overall === "amber"
        ? "text-amber-300"
        : overall === "green"
          ? "text-emerald-300"
          : "text-zinc-400";

  return (
    <div className="mt-3 space-y-1.5">
      <p className={`text-xs font-medium ${pill}`}>
        {overall === "rose" ? "Pay attention" : overall === "amber" ? "Check a few things" : overall === "green" ? "Looks quiet" : "Gathering"}
      </p>
      <p className="text-xs text-zinc-400">{paint?.title}</p>
      <p className="text-xs text-zinc-400">{around?.title}</p>
      <p className="text-xs text-zinc-500">{file?.title}</p>
    </div>
  );
}
