import { auth0, hasAuth0 } from "@/lib/auth0";
import { googleClientId, hasGoogleAuth, readGoogleSession } from "@/lib/googleAuth";
import { getIdentityRole } from "@/lib/store";

export async function GET() {
  if (hasAuth0 && auth0) {
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

    return Response.json({
      mode: "auth0" as const,
      loggedIn: true,
      needsRole: false,
      identity: { id, name, role },
    });
  }

  if (hasGoogleAuth()) {
    const session = await readGoogleSession();
    const clientId = googleClientId();
    if (!session) {
      return Response.json({ mode: "google" as const, loggedIn: false, clientId });
    }
    const role = await getIdentityRole(session.id);
    if (!role) {
      return Response.json({
        mode: "google" as const,
        loggedIn: true,
        needsRole: true,
        id: session.id,
        name: session.name,
        clientId,
      });
    }
    return Response.json({
      mode: "google" as const,
      loggedIn: true,
      needsRole: false,
      identity: { id: session.id, name: session.name, role },
      clientId,
    });
  }

  return Response.json({ mode: "lite" as const });
}
