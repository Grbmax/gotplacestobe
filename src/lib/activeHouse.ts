const KEY = "scan:lastPropertyId";
const EVENT = "scan:house";

export function rememberHouse(id: string | null | undefined) {
  if (!id || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, id);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode */
  }
}

export function lastHouse(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLastHouse() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode */
  }
}

export function rememberWalk(propertyId: string, walkId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${KEY}:walk:${propertyId}`, walkId);
  } catch {
    /* private mode */
  }
}

export function lastWalk(propertyId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(`${KEY}:walk:${propertyId}`);
  } catch {
    return null;
  }
}

export function onHouseChange(fn: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
