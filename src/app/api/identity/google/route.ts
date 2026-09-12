import { NextRequest } from "next/server";
import {
  clearGoogleSession,
  hasGoogleAuth,
  verifyGoogleIdToken,
  writeGoogleSession,
} from "@/lib/googleAuth";

export async function POST(request: NextRequest) {
  if (!hasGoogleAuth()) {
    return Response.json({ error: "Google sign-in is not configured" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as { credential?: string } | null;
  const verified = await verifyGoogleIdToken(body?.credential ?? "");
  if (!verified) {
    return Response.json({ error: "Google sign-in failed" }, { status: 401 });
  }
  await writeGoogleSession(verified.id, verified.name);
  return Response.json({ ok: true, name: verified.name });
}

export async function DELETE() {
  await clearGoogleSession();
  return Response.json({ ok: true });
}
