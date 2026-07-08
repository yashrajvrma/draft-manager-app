import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/db";
import { getSession } from "@/lib/session";
import { updateDraftSchema } from "@/schema/validation";

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/drafts/[id]">,
) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseId((await ctx.params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const draft = await prisma.draft.findUnique({ where: { id } });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(draft);
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/drafts/[id]">,
) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = parseId((await ctx.params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateDraftSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { version, ...fields } = parsed.data;

  // Optimistic concurrency control: the UPDATE only matches when the row is
  // still at the version the client loaded. Postgres makes this atomic, so two
  // concurrent saves can never both succeed — the loser matches 0 rows.
  const result = await prisma.draft.updateMany({
    where: { id, version },
    data: { ...fields, version: { increment: 1 } },
  });

  if (result.count === 1) {
    const updated = await prisma.draft.findUnique({ where: { id } });
    return NextResponse.json(updated);
  }

  // 0 rows updated: either the draft is gone (404) or the version is stale
  // (409). Return the current server copy so the UI can show the newer state.
  const current = await prisma.draft.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    {
      error: "Version conflict",
      message:
        "This draft was updated by someone else. Review the latest version and retry.",
      current,
    },
    { status: 409 },
  );
}
