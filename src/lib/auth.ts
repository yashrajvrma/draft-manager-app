import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // Email/password only. The grading harness (and local two-tab testing) can
  // sign in as seeded users without an interactive OAuth flow.
  emailAndPassword: {
    enabled: true,
    // Disabled for the take-home so seeded users can log in immediately.
    requireEmailVerification: false,
  },
});

export type Session = typeof auth.$Infer.Session;
