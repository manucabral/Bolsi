import { getBolsiApi } from "./pywebview";
import type {
  CategoryType,
  CreateCategoryResult,
  DeleteCategoryResult,
  ListCategoriesResult,
  UpdateCategoryResult,
} from "./categories.api.types";

export async function listCategories(
  userId: number,
): Promise<ListCategoriesResult> {
  const api = await getBolsiApi();
  return api.categories_list(userId);
}

export async function createCategory(
  userId: number,
  name: string,
  categoryType: CategoryType,
  color?: string,
): Promise<CreateCategoryResult> {
  const api = await getBolsiApi();
  return api.categories_create(userId, name, categoryType, color);
}

export async function updateCategory(
  userId: number,
  categoryId: number,
  name: string,
  categoryType: CategoryType,
  color?: string,
): Promise<UpdateCategoryResult> {
  const api = await getBolsiApi();
  return api.categories_update(userId, categoryId, name, categoryType, color);
}

export async function deleteCategory(
  userId: number,
  categoryId: number,
): Promise<DeleteCategoryResult> {
  const api = await getBolsiApi();
  return api.categories_delete(userId, categoryId);
}
