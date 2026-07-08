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
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-zinc-900 dark:text-zinc-50">
          Draft Manager
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.user && (
            <span className="text-zinc-500">
              Signed in as{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {session.user.email}
              </span>
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
