import type { ApiResponse } from "./user.api.types";

export type BackendTransactionType = "income" | "expense";

export interface TransactionItem {
  id: number;
  user_id: number;
  amount: number;
  type: BackendTransactionType;
  category_id?: number | null;
  category_name?: string | null;
  category_color?: string | null;
  description?: string | null;
  date: string;
  credit_id?: number | null;
}

export type ListTransactionsResult = ApiResponse<{
  transactions?: TransactionItem[];
  [key: string]: unknown;
}>;

export type CreateTransactionResult = ApiResponse<{
  transaction?: TransactionItem;
  [key: string]: unknown;
}>;

export type UpdateTransactionResult = ApiResponse<{
  transaction?: TransactionItem;
  [key: string]: unknown;
}>;

export type DeleteTransactionResult = ApiResponse<Record<string, unknown>>;
