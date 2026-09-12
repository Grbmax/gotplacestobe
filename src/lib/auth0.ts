import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const hasAuth0 = Boolean(
  process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET &&
    process.env.AUTH0_SECRET,
);

/**
 * Real Auth0 login when the four required env vars are set (get them from
 * manage.auth0.com — Applications → create a Regular Web Application).
 * Falls back to null so the rest of the app can run on the lite,
 * localStorage-based identity picker with zero configuration.
 */
export const auth0: Auth0Client | null = (() => {
  if (!hasAuth0) return null;
  try {
    return new Auth0Client();
  } catch (err) {
    console.error("[auth0] failed to construct client, falling back to lite mode", err);
    return null;
  }
})();
