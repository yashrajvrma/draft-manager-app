import { auth } from "./auth";

/**
 * Returns the current session or null. Route handlers pass their request
 * headers so Better Auth can read the session cookie.
 */
export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
