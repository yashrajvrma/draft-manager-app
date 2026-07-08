"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import {
  ALL_TAGS,
  DRAFT_STATUSES,
  DRAFT_TYPES,
  type Draft,
} from "@/lib/types";

type FormState = {
  title: string;
  type: string;
  body: string;
  tags: string[];
  status: string;
};

function toForm(d: Draft): FormState {
  return {
    title: d.title,
    type: d.type,
    body: d.body,
    tags: d.tags,
    status: d.status,
  };
}

export default function EditDraftPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  // `server` is the last state we know the server holds (incl. its version).
  const [server, setServer] = useState<Draft | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When set, someone else saved a newer version while we were editing.
  const [conflict, setConflict] = useState<Draft | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/drafts/${id}`);
      if (!active) return;
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const d: Draft = await res.json();
      setServer(d);
      setForm(toForm(d));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  function toggleTag(t: string) {
    setForm((f) =>
      !f
        ? f
        : {
            ...f,
            tags: f.tags.includes(t)
              ? f.tags.filter((x) => x !== t)
              : [...f.tags, t],
          },
    );
  }

  async function save(expectedVersion: number) {
    if (!form || !server) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);

    // Optimistic: reflect the new version immediately; roll back if rejected.
    const previous = server;
    const optimistic: Draft = {
      ...server,
      ...form,
      version: expectedVersion + 1,
    };
    setServer(optimistic);

    try {
      const res = await fetch(`/api/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, version: expectedVersion }),
      });

      if (res.ok) {
        const updated: Draft = await res.json();
        setServer(updated);
        setForm(toForm(updated));
        setConflict(null);
        setSavedAt(Date.now());
        return;
      }

      // Rejected — roll the optimistic change back to the prior server state.
      setServer(previous);

      if (res.status === 409) {
        const payload = await res.json();
        setConflict(payload.current as Draft);
        return;
      }
      if (res.status === 400) {
        setError("Invalid input — check the title and fields.");
        return;
      }
      setError(`Save failed (${res.status}).`);
    } catch {
      setServer(previous);
      setError("Network error — your change was not saved.");
    } finally {
      setSaving(false);
    }
  }

  // Conflict resolution: keep my edits but base them on their version.
  function overwriteTheirs() {
    if (!conflict) return;
    setConflict(null);
    save(conflict.version);
  }

  // Conflict resolution: discard my edits and load their version.
  function loadTheirs() {
    if (!conflict) return;
    setServer(conflict);
    setForm(toForm(conflict));
    setConflict(null);
    setError(null);
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-zinc-400">
          Loading…
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
          <p className="text-zinc-500">Draft #{id} not found.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to drafts
          </Link>
        </main>
      </>
    );
  }

  if (!form || !server) return null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← Back to drafts
          </Link>
          <span className="text-xs text-zinc-400">
            Draft #{server.id} · version {server.version}
          </span>
        </div>

        {conflict && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              This draft was updated by someone else (now version{" "}
              {conflict.version}).
            </p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              Their title: <span className="font-medium">{conflict.title}</span>
              . Your unsaved edits are still in the form below.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={overwriteTheirs}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
              >
                Keep my edits &amp; save over theirs
              </button>
              <button
                onClick={loadTheirs}
                className="rounded-md border border-amber-400 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900"
              >
                Discard mine &amp; load their version
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {savedAt && !error && !conflict && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            Saved. Now at version {server.version}.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(server.version);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {DRAFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {DRAFT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Tags
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ALL_TAGS.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    form.tags.includes(t)
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Body
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={8}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
