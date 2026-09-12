import { auth0, hasAuth0 } from "@/lib/auth0";
import { getIdentityRole } from "@/lib/store";

export async function GET() {
  if (!hasAuth0 || !auth0) {
    return Response.json({ mode: "lite" as const });
  }

  const session = await auth0.getSession();
  if (!session?.user) {
    return Response.json({ mode: "auth0" as const, loggedIn: false });
  }

  const id = session.user.sub;
  const name = session.user.name ?? session.user.email ?? "Signed in";
  const role = await getIdentityRole(id);

  if (!role) {
    return Response.json({ mode: "auth0" as const, loggedIn: true, needsRole: true, id, name });
  }

  return Response.json({ mode: "auth0" as const, loggedIn: true, needsRole: false, identity: { id, name, role } });
}
