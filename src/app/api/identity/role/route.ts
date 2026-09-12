import { NextRequest } from "next/server";
import { auth0, hasAuth0 } from "@/lib/auth0";
import { ROLES } from "@/lib/identity";
import { setIdentityRole } from "@/lib/store";
import type { Role } from "@/lib/types";

export async function POST(request: NextRequest) {
  if (!hasAuth0 || !auth0) {
    return Response.json({ error: "Auth0 not configured" }, { status: 400 });
  }
  const session = await auth0.getSession();
  if (!session?.user) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = (await request.json()) as { role?: Role };
  if (!body.role || !ROLES.includes(body.role)) {
    return Response.json({ error: "Invalid role" }, { status: 400 });
  }
  const name = session.user.name ?? session.user.email ?? "Signed in";
  await setIdentityRole(session.user.sub, name, body.role);
  return Response.json({ identity: { id: session.user.sub, name, role: body.role } });
}
