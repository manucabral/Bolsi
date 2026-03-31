import type { ApiResponse } from "./user.api.types";

export type BillStatus = "pending" | "paid" | "overdue";

export interface BillItem {
  id: number;
  user_id: number;
  name: string;
  amount: number;
  paid_amount?: number;
  remaining_amount?: number;
  payment_progress?: number;
  due_date: string;
  category_id?: number | null;
  category_name?: string | null;
  category_color?: string | null;
  status: BillStatus;
  notes: string;
  paid_at?: string | null;
  created_at: string;
  days_until_due?: number | null;
  is_due_soon?: boolean;
}

export type ListBillsResult = ApiResponse<{
  bills?: BillItem[];
  [key: string]: unknown;
}>;

export type ListMonthBillsResult = ApiResponse<{
  year?: number;
  month?: number;
  bills?: BillItem[];
  [key: string]: unknown;
}>;

export type CreateBillResult = ApiResponse<{
  bill?: BillItem;
  [key: string]: unknown;
}>;

export type UpdateBillResult = ApiResponse<{
  bill?: BillItem;
  [key: string]: unknown;
}>;

export type MarkBillPaidResult = ApiResponse<{
  bill?: BillItem;
  generated_transaction_id?: number;
  applied_amount?: number;
  remaining_amount?: number;
  [key: string]: unknown;
}> & {
  bill?: BillItem;
  generated_transaction_id?: number;
  applied_amount?: number;
  remaining_amount?: number;
};

export type MarkBillUnpaidResult = ApiResponse<{
  bill?: BillItem;
  [key: string]: unknown;
}> & {
  bill?: BillItem;
};

export type DeleteBillResult = ApiResponse<Record<string, unknown>>;
