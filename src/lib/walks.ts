import type { Scan, Walk, WalkKind } from "@/lib/types";

export const WALK_KINDS: { value: WalkKind; label: string; blurb: string }[] = [
  { value: "move_in", label: "Move-in", blurb: "Condition when you arrived." },
  { value: "mid", label: "Mid-stay", blurb: "A check during the lease." },
  { value: "exit", label: "Exit", blurb: "Condition when you leave." },
];

export function walkKindLabel(kind: WalkKind) {
  return WALK_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

export function walksChronological(walks: Walk[]) {
  return [...walks].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function openWalk(walks: Walk[]) {
  const open = walks.filter((w) => !w.closedAt);
  return open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
}

export function suggestedWalkKind(walks: Walk[]): WalkKind {
  const kinds = new Set(walks.map((w) => w.kind));
  if (!kinds.has("move_in")) return "move_in";
  if (!kinds.has("exit")) return "exit";
  return "mid";
}

export function scansForWalk(scans: Scan[], walkId: string | "all") {
  if (walkId === "all") return scans;
  return scans.filter((s) => (s.walkId ?? "") === walkId);
}

export function groupScansByWalk(scans: Scan[], walks: Walk[]) {
  const byId = new Map(walks.map((w) => [w.id, w]));
  const groups: { walk: Walk | null; scans: Scan[] }[] = walksChronological(walks).map((walk) => ({
    walk,
    scans: scans.filter((s) => s.walkId === walk.id),
  }));
  const orphan = scans.filter((s) => !s.walkId || !byId.has(s.walkId));
  if (orphan.length) groups.unshift({ walk: null, scans: orphan });
  return groups.filter((g) => g.scans.length > 0 || g.walk);
}
