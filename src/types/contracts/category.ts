/**
 * Canonical category contract. Today categories are a hardcoded list in
 * `src/constants/categories.ts` (`EXPENDITURE_CATEGORIES`, `REVENUE_CATEGORIES`),
 * referenced by `category_id` (free text, not a foreign key). This contract
 * is the shape a future `categories` table or Stage 5 category-matching
 * dictionary should converge on; it deliberately mirrors the existing
 * `Category` shape in `src/constants/categories.ts` so no migration of the
 * built-in list is required.
 */

import type { TransactionType } from "./transaction";

export type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Stage 5: which transaction type this category applies to, for keyword matching. */
  appliesTo: TransactionType;
  /** Stage 5: extra keywords/aliases the deterministic parser matches against (e.g. "uber" -> transport). */
  keywords?: string[];
};
