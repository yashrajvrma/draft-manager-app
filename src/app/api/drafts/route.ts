import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { listQuerySchema } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { q, type, status, tag, page, pageSize, sort, dir } = parsed.data;

  const where: Prisma.DraftWhereInput = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { body: { contains: q, mode: "insensitive" } },
    ];
  }

  // Stable ordering: a unique tiebreaker on `id` guarantees no row is
  // duplicated or skipped across pages even when the primary key ties.
  const orderBy: Prisma.DraftOrderByWithRelationInput[] =
    sort === "id" ? [{ id: dir }] : [{ [sort]: dir }, { id: dir }];

  const [items, total] = await Promise.all([
    prisma.draft.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.draft.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
