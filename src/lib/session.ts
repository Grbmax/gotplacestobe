import type { Session, ZoneId } from "./types";

const KEY = "quest.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.id) parsed.id = crypto.randomUUID();
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function createSession(name: string, zone: ZoneId): Session {
  const session: Session = {
    id: crypto.randomUUID(),
    name,
    zone,
    karma: 100,
    completed: 3,
    bailed: 0,
  };
  saveSession(session);
  return session;
}
