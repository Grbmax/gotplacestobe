import { NextRequest } from "next/server";
import { auth0, hasAuth0 } from "@/lib/auth0";
import { hasGoogleAuth, readGoogleSession } from "@/lib/googleAuth";
import { ROLES } from "@/lib/identity";
import { setIdentityRole } from "@/lib/store";
import type { Role } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { role?: Role };
  if (!body.role || !ROLES.includes(body.role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }

  if (hasAuth0 && auth0) {
    const session = await auth0.getSession();
    if (!session?.user) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    const name = session.user.name ?? session.user.email ?? "Signed in";
    await setIdentityRole(session.user.sub, name, body.role);
    return Response.json({ identity: { id: session.user.sub, name, role: body.role } });
  }

  if (hasGoogleAuth()) {
    const session = await readGoogleSession();
    if (!session) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    await setIdentityRole(session.id, session.name, body.role);
    return Response.json({ identity: { id: session.id, name: session.name, role: body.role } });
  }

  return Response.json({ error: "Auth not configured" }, { status: 400 });
}
