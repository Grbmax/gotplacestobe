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
      className={`inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs text-zinc-200 ${className}`}
      title="Switch identity"
    >
      <span className="font-medium">{identity.name || "You"}</span>
      <span className="text-emerald-400">· {ROLE_LABEL[identity.role]}</span>
    </button>
  );
}
