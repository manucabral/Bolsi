import type { ApiResponse } from "./user.api.types";

export type CategoryType = "income" | "expense";

export interface CategoryItem {
  id: number;
  user_id: number;
  name: string;
  color?: string | null;
  type: CategoryType;
}

export type ListCategoriesResult = ApiResponse<{
  categories?: CategoryItem[];
  [key: string]: unknown;
}>;

export type CreateCategoryResult = ApiResponse<{
  category?: CategoryItem;
  [key: string]: unknown;
}>;

export type UpdateCategoryResult = ApiResponse<{
  category?: CategoryItem;
  [key: string]: unknown;
}>;

export type DeleteCategoryResult = ApiResponse<Record<string, unknown>>;
