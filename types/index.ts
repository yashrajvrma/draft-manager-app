import { DRAFT_TYPES, DRAFT_STATUSES } from "@/schema/validation";

export { DRAFT_TYPES, DRAFT_STATUSES };

/** Plain, serializable Draft shape shared across client components. */
export type Draft = {
  id: number;
  title: string;
  type: string;
  body: string;
  tags: string[];
  author: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ListResponse = {
  items: Draft[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const ALL_TAGS = [
  "q3",
  "promo",
  "ai",
  "brand",
  "urgent",
  "evergreen",
  "paid",
  "organic",
] as const;
