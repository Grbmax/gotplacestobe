"use client";

import { useEffect, useState } from "react";
import { useIdentity } from "@/lib/IdentityContext";
import { PROPERTY_KINDS } from "@/lib/labels";
import type { Property } from "@/lib/types";

export function AddHouseSheet({
  open,
  initialLabel = "",
  onClose,
  onCreated,
}: {
  open: boolean;
  initialLabel?: string;
  onClose: () => void;
  onCreated: (property: Property) => void;
}) {
  const { identity } = useIdentity();
  const [label, setLabel] = useState(initialLabel);
  const [unit, setUnit] = useState("");
  const [kind, setKind] = useState<Property["kind"]>("lease");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setUnit("");
    setError(null);
  }, [open, initialLabel]);

  if (!open) return null;

  async function createProperty(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          kind,
          unit: unit.trim() || undefined,
          createdBy: identity.id,
          createdByName: identity.name,
        }),
      });
      const data = (await res.json()) as { property?: Property; error?: string };
      if (!res.ok || !data.property) throw new Error(data.error ?? "create failed");
      onCreated(data.property);
    } catch {
      setError("Could not create property");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close add house" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-slate-200 bg-white p-4 pb-8 text-slate-900">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Add a house</h2>
          <button type="button" onClick={onClose} className="text-xs text-slate-500">
            Cancel
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Same street address reopens that house. Start a new walk for mid-stay or exit instead of adding a duplicate.</p>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <form onSubmit={createProperty} className="mt-4 space-y-3">
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-500">Rental address</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="5614 Beacon St"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
            required
            autoFocus
          />
          <label className="block text-[11px] uppercase tracking-[0.18em] text-slate-500">Apt / unit (if any)</label>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="2B"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
          />
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Property type">
            {PROPERTY_KINDS.map((item) => {
              const selected = kind === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setKind(item.value)}
                  aria-pressed={selected}
                  className={
                    selected
                      ? "rounded-xl border border-emerald-600 bg-emerald-50 py-3 text-sm font-medium text-emerald-800"
                      : "rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm text-slate-600"
                  }
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Opening house…" : "Scan this house"}
          </button>
        </form>
      </div>
    </div>
  );
}
