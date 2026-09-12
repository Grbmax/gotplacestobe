"use client";

import { ROLE_LABEL } from "@/lib/identity";
import { useIdentity } from "@/lib/IdentityContext";

/** Small, persistent "who am I" indicator — the whole point is you're never unsure again. */
export function IdentityChip({ className = "" }: { className?: string }) {
  const { identity, switchIdentity } = useIdentity();
  return (
    <button
      type="button"
      onClick={switchIdentity}
      className={`inline-flex max-w-[11rem] items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 ${className}`}
      title="Switch identity"
    >
      <span className="min-w-0 truncate font-medium">{identity.name || "You"}</span>
      <span className="shrink-0 text-emerald-700">· {ROLE_LABEL[identity.role]}</span>
    </button>
  );
}
