"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL: the client calls its own origin, so requests are always
// same-origin (the auth API is served from this same Next.js app). This
// avoids any cross-origin/CORS issue in both dev and production.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
});

export const { signIn, signOut, signUp, useSession } = authClient;
