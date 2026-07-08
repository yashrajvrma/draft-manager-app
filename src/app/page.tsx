"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import {
  ALL_TAGS,
  DRAFT_STATUSES,
  DRAFT_TYPES,
  type ListResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;
const POLL_MS = 4000;

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  "In Review": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Approved: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Published: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
};

export default function DraftsPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text query so we don't fire a request per keystroke.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, type, status, tag]);

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (type) p.set("type", type);
    if (status) p.set("status", status);
    if (tag) p.set("tag", tag);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return `/api/drafts?${p.toString()}`;
  }, [debouncedQ, type, status, tag, page]);

  // Keep the latest URL in a ref so the poll timer always fetches current filters.
  const urlRef = useRef(buildUrl());
  urlRef.current = buildUrl();

  const fetchData = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(urlRef.current);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json: ListResponse = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  // Refetch on filter/page change (with spinner).
  useEffect(() => {
    fetchData(true);
  }, [buildUrl, fetchData]);

  // Poll in the background so edits from other sessions show up.
  useEffect(() => {
    const id = setInterval(() => fetchData(false), POLL_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  const resetFilters = () => {
    setQ("");
    setType("");
    setStatus("");
    setTag("");
  };

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Drafts
            </h1>
            <p className="text-sm text-zinc-500">
              {data ? `${data.total} drafts` : "Loading…"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or body…"
            className="min-w-56 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All types</option>
            {DRAFT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All statuses</option>
            {DRAFT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All tags</option>
            {ALL_TAGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            onClick={resetFilters}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            Reset
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Author</th>
                <th className="px-3 py-2 font-medium">v</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {loading && !data ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-zinc-400">
                    Loading…
                  </td>
                </tr>
              ) : data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-zinc-400">
                    No drafts match your filters.
                  </td>
                </tr>
              ) : (
                data?.items.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-3 py-2 text-zinc-400">{d.id}</td>
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                      {d.title}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{d.type}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          STATUS_STYLES[d.status] ?? ""
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {d.tags.join(", ")}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">{d.author}</td>
                    <td className="px-3 py-2 text-zinc-400">{d.version}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {new Date(d.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/drafts/${d.id}`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                className="rounded-md border border-zinc-300 px-3 py-1.5 disabled:opacity-40 dark:border-zinc-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
