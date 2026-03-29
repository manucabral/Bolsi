import type { ApiResponse } from "./user.api.types";

export interface CreditItem {
  id: number;
  user_id: number;
  description: string;
  total_amount: number;
  installments: number;
  installment_amount: number;
  start_date: string;
  category_id?: number | null;
  category_name?: string | null;
  category_color?: string | null;
  paid_installments: number;
  created_at?: string;
}

export type ListCreditsResult = ApiResponse<{
  credits?: CreditItem[];
  [key: string]: unknown;
}>;

export type CreateCreditResult = ApiResponse<{
  credit?: CreditItem;
  generated_installments?: number;
  [key: string]: unknown;
}>;

export type UpdateCreditResult = ApiResponse<{
  credit?: CreditItem;
  generated_installments?: number;
  [key: string]: unknown;
}>;

export type DeleteCreditResult = ApiResponse<Record<string, unknown>>;
