"use client";

import { HouseSelect } from "@/components/HouseSelect";
import type { Property } from "@/lib/types";

/** @deprecated Use HouseSelect intent="scan" */
export function ScanHousePicker({
  houses,
  lastId,
  onPick,
}: {
  houses: Property[];
  lastId: string | null;
  onPick: (property: Property) => void;
}) {
  return <HouseSelect intent="scan" houses={houses} lastId={lastId} onCreated={onPick} />;
}
