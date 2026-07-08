"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import ConflictCompareModal from "@/components/ConflictCompareModal";
import {
  ALL_TAGS,
  DRAFT_STATUSES,
  DRAFT_TYPES,
  type Draft,
} from "@/types";

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

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/40";

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
  // Controls the side-by-side compare modal (auto-opens on conflict).
  const [showCompare, setShowCompare] = useState(false);

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
        setShowCompare(true); // auto-open the side-by-side comparison
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
    setShowCompare(false);
    setConflict(null);
    save(conflict.version);
  }

  // Conflict resolution: discard my edits and load their version.
  function loadTheirs() {
    if (!conflict) return;
    setServer(conflict);
    setForm(toForm(conflict));
    setShowCompare(false);
    setConflict(null);
    setError(null);
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 text-muted-foreground">
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
          <p className="text-muted-foreground">Draft #{id} not found.</p>
          <Link href="/" className="text-primary hover:underline">
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
          <Link href="/" className="text-sm text-primary hover:underline">
            ← Back to drafts
          </Link>
          <span className="text-xs text-muted-foreground">
            Draft #{server.id} · version {server.version}
          </span>
        </div>

        {conflict && (
          <div className="mb-4 rounded-lg border border-primary/40 bg-accent p-4 text-accent-foreground">
            <p className="font-medium">
              This draft was updated by someone else (now version{" "}
              {conflict.version}).
            </p>
            <p className="mt-1 text-sm">
              Your unsaved edits are still in the form. Compare the two versions
              side by side, then choose how to resolve it.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setShowCompare(true)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Compare changes
              </button>
              <button
                onClick={overwriteTheirs}
                className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Keep mine
              </button>
              <button
                onClick={loadTheirs}
                className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Load theirs
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {savedAt && !error && !conflict && (
          <p className="mb-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
            Saved. Now at version {server.version}.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(server.version);
          }}
          className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div>
            <label className="block text-sm font-medium text-foreground">
              Title
            </label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputClass}
              >
                {DRAFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={inputClass}
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
            <label className="block text-sm font-medium text-foreground">
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
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">
              Body
            </label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={8}
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>

      {showCompare && conflict && (
        <ConflictCompareModal
          mine={form}
          theirs={conflict}
          onKeepMine={overwriteTheirs}
          onLoadTheirs={loadTheirs}
          onClose={() => setShowCompare(false)}
        />
      )}
    </>
  );
}
