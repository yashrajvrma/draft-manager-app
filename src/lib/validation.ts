import { z } from "zod";

export const DRAFT_TYPES = ["social", "article", "caption"] as const;
export const DRAFT_STATUSES = [
  "Draft",
  "In Review",
  "Approved",
  "Published",
] as const;

export const SORT_FIELDS = ["updatedAt", "createdAt", "title", "id"] as const;

/** Query params for the list endpoint. Coerces strings from the URL. */
export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  type: z.enum(DRAFT_TYPES).optional(),
  status: z.enum(DRAFT_STATUSES).optional(),
  tag: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(SORT_FIELDS).default("updatedAt"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * Body for updating a draft. `version` is the expected current version the
 * client loaded; the server rejects the save if it no longer matches.
 */
export const updateDraftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  type: z.enum(DRAFT_TYPES),
  body: z.string().max(20000),
  tags: z.array(z.string().trim().min(1).max(50)).max(20),
  status: z.enum(DRAFT_STATUSES),
  version: z.number().int().min(1),
});

export type UpdateDraftInput = z.infer<typeof updateDraftSchema>;
