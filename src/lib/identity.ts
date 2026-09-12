import type { Identity, Role } from "./types";

export const ROLES: Role[] = ["tenant", "owner", "inspector"];

export const ROLE_LABEL: Record<Role, string> = {
  tenant: "Renter",
  owner: "Landlord",
  inspector: "Inspector",
};

export const ROLE_BLURB: Record<Role, string> = {
  tenant: "Track a place you live in, are moving into, or are handing back.",
  owner: "Keep an eye on surfaces across the places you own.",
  inspector: "Review and confirm findings on someone else's behalf.",
};

const STORAGE_KEY = "scan.identity";

/** Client-only. Lite-mode identity, used when Auth0 isn't configured. */
export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed.id || !parsed.name || !ROLES.includes(parsed.role)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveIdentity(identity: Identity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    /* ignore — worst case the picker shows again next load */
  }
}

export function clearIdentity() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Deterministic from the name, not random — lite mode has no password or
 * verification anyway, so there's nothing "more secure" about a random id,
 * and a random one meant typing your name again in a new browser (or after
 * clearing storage) orphaned every property you'd already created. Same
 * name now always resumes the same identity.
 */
export function identityIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `id_${slug || "guest"}`;
}
