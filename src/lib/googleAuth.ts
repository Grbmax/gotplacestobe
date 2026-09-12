import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const GOOGLE_COOKIE = "cribcheck_google";

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

type CookiePayload = { sub: string; name: string; exp: number };

export function googleClientId(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? "").trim();
}

export function hasGoogleAuth(): boolean {
  return Boolean(googleClientId() && signingSecret());
}

function signingSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH0_SECRET || "";
}

function encode(payload: CookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function decode(raw: string): CookiePayload | null {
  const secret = signingSecret();
  if (!secret) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CookiePayload;
    if (!payload.sub || !payload.name || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readGoogleSession(): Promise<{ id: string; name: string } | null> {
  if (!hasGoogleAuth() || !signingSecret()) return null;
  const jar = await cookies();
  const raw = jar.get(GOOGLE_COOKIE)?.value;
  if (!raw) return null;
  const payload = decode(raw);
  if (!payload) return null;
  return { id: payload.sub, name: payload.name };
}

export async function writeGoogleSession(id: string, name: string): Promise<void> {
  const jar = await cookies();
  jar.set(GOOGLE_COOKIE, encode({ sub: id, name, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearGoogleSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(GOOGLE_COOKIE);
}

/** Verifies a Google Identity Services ID token. Graceful null on any failure. */
export async function verifyGoogleIdToken(credential: string): Promise<{ id: string; name: string } | null> {
  const clientId = googleClientId();
  if (!clientId || !credential) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      aud?: string;
      sub?: string;
      name?: string;
      email?: string;
      email_verified?: string | boolean;
    };
    if (data.aud !== clientId || !data.sub) return null;
    if (data.email_verified === false || data.email_verified === "false") return null;
    const name = (data.name || data.email || "Signed in").trim();
    return { id: data.sub, name };
  } catch {
    return null;
  }
}
