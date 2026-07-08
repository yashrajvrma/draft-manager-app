"use client";

import { useEffect } from "react";
import { diffWords } from "diff";
import type { Draft } from "@/types";

type MineShape = {
  title: string;
  type: string;
  body: string;
  tags: string[];
  status: string;
};

/**
 * Side-by-side comparison of the user's unsaved edits ("Yours") against the
 * copy now on the server ("Theirs"). Classic split diff: the left column shows
 * unchanged + your-only text (removals highlighted red); the right column shows
 * unchanged + their additions (highlighted green).
 */
export default function ConflictCompareModal({
  mine,
  theirs,
  onKeepMine,
  onLoadTheirs,
  onClose,
}: {
  mine: MineShape;
  theirs: Draft;
  onKeepMine: () => void;
  onLoadTheirs: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scalarFields = [
    { label: "Title", mine: mine.title, theirs: theirs.title },
    { label: "Type", mine: mine.type, theirs: theirs.type },
    { label: "Status", mine: mine.status, theirs: theirs.status },
  ].filter((f) => f.mine !== f.theirs);

  const tagsAdded = theirs.tags.filter((t) => !mine.tags.includes(t));
  const tagsRemoved = mine.tags.filter((t) => !theirs.tags.includes(t));
  const tagsChanged = tagsAdded.length > 0 || tagsRemoved.length > 0;

  const bodyChanged = mine.body !== theirs.body;
  const bodyParts = diffWords(mine.body, theirs.body);
  const bodyMine = bodyParts.filter((p) => !p.added); // unchanged + removed
  const bodyTheirs = bodyParts.filter((p) => !p.removed); // unchanged + added

  const nothingChanged =
    scalarFields.length === 0 && !tagsChanged && !bodyChanged;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">
              Compare changes
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Someone else saved version {theirs.version} while you were editing.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Legend */}
          <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-destructive/20" />
              Only in yours (lost if you load theirs)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-primary/25" />
              Added in their version
            </span>
          </div>

          {nothingChanged ? (
            <p className="text-sm text-muted-foreground">
              Your edits match their version — saving again will succeed.
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-2 gap-4">
                <ColHead label="Yours (unsaved)" />
                <ColHead label={`Theirs (version ${theirs.version})`} />
              </div>

              {/* Scalar fields */}
              {scalarFields.map((f) => (
                <FieldSection key={f.label} label={f.label}>
                  <Cell tone="mine">{f.mine || "—"}</Cell>
                  <Cell tone="theirs">{f.theirs || "—"}</Cell>
                </FieldSection>
              ))}

              {/* Tags */}
              {tagsChanged && (
                <FieldSection label="Tags">
                  <Cell tone="mine">
                    <TagList tags={mine.tags} highlight={tagsRemoved} tone="mine" />
                  </Cell>
                  <Cell tone="theirs">
                    <TagList
                      tags={theirs.tags}
                      highlight={tagsAdded}
                      tone="theirs"
                    />
                  </Cell>
                </FieldSection>
              )}

              {/* Body split diff */}
              {bodyChanged && (
                <FieldSection label="Body">
                  <Cell tone="mine" mono>
                    {bodyMine.map((p, i) => (
                      <span
                        key={i}
                        className={
                          p.removed
                            ? "rounded-sm bg-destructive/20 text-destructive"
                            : ""
                        }
                      >
                        {p.value}
                      </span>
                    ))}
                  </Cell>
                  <Cell tone="theirs" mono>
                    {bodyTheirs.map((p, i) => (
                      <span
                        key={i}
                        className={p.added ? "rounded-sm bg-primary/25" : ""}
                      >
                        {p.value}
                      </span>
                    ))}
                  </Cell>
                </FieldSection>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
          >
            Close
          </button>
          <button
            onClick={onLoadTheirs}
            className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            Discard mine &amp; load theirs
          </button>
          <button
            onClick={onKeepMine}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Keep my edits &amp; save over theirs
          </button>
        </div>
      </div>
    </div>
  );
}

function ColHead({ label }: { label: string }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
  );
}

function FieldSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Cell({
  tone,
  mono,
  children,
}: {
  tone: "mine" | "theirs";
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-h-9 whitespace-pre-wrap rounded-md border px-3 py-2 text-sm leading-relaxed ${
        tone === "mine"
          ? "border-destructive/20 bg-destructive/5"
          : "border-primary/20 bg-primary/5"
      } ${mono ? "max-h-64 overflow-y-auto" : ""}`}
    >
      {children}
    </div>
  );
}

function TagList({
  tags,
  highlight,
  tone,
}: {
  tags: string[];
  highlight: string[];
  tone: "mine" | "theirs";
}) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const hot = highlight.includes(t);
        return (
          <span
            key={t}
            className={`rounded-full px-2 py-0.5 text-xs ${
              hot
                ? tone === "theirs"
                  ? "bg-primary/25 text-foreground"
                  : "bg-destructive/20 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
}
