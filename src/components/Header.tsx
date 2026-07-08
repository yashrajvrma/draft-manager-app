"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";

export default function Header() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-card-foreground">
          Draft Manager
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user && (
            <span className="text-muted-foreground">
              Signed in as{" "}
              <span className="font-medium text-foreground">
                {session.user.email}
              </span>
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
