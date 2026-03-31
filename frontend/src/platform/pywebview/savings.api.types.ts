import type { ApiResponse } from "./user.api.types";

export interface SavingsGoalItem {
  id: number;
  user_id: number;
  name: string;
  target: number;
  current: number;
  remaining: number;
  progress: number;
  affects_balance: boolean;
  deadline?: string | null;
  color?: string | null;
  created_at: string;
}

export interface SavingsEntryItem {
  id: number;
  goal_id: number;
  user_id: number;
  amount: number;
  note: string;
  date: string;
  created_at: string;
}

export type ListSavingsGoalsResult = ApiResponse<{
  goals?: SavingsGoalItem[];
  [key: string]: unknown;
}>;

export type CreateSavingsGoalResult = ApiResponse<{
  goal?: SavingsGoalItem;
  [key: string]: unknown;
}>;

export type AddSavingsEntryResult = ApiResponse<{
  goal?: SavingsGoalItem;
  entry?: SavingsEntryItem;
  generated_transaction_id?: number;
  [key: string]: unknown;
}> & {
  goal?: SavingsGoalItem;
  entry?: SavingsEntryItem;
  generated_transaction_id?: number;
};

export type UpdateSavingsGoalTargetResult = ApiResponse<{
  goal?: SavingsGoalItem;
  [key: string]: unknown;
}> & {
  goal?: SavingsGoalItem;
};

export type DeleteSavingsGoalResult = ApiResponse<{
  goal_id?: number;
  [key: string]: unknown;
}> & {
  goal_id?: number;
};
