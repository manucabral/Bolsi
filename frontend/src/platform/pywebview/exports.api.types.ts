import type { ApiResponse } from "./user.api.types";

export type ExportFormat = "xlsx" | "pdf";

export type ExportSection =
  | "summary"
  | "transactions"
  | "credits"
  | "bills"
  | "categories"
  | "notes";

export interface ExportFileInfo {
  file_path: string;
  file_name: string;
  format: ExportFormat;
  section: ExportSection;
  row_count: number;
}

export type GenerateExportResult = ApiResponse<{
  file_path?: string;
  file_name?: string;
  format?: ExportFormat;
  section?: ExportSection;
  row_count?: number;
  [key: string]: unknown;
}> &
  Partial<ExportFileInfo>;

export type OpenExportFolderResult = ApiResponse<{
  folder_path?: string;
  [key: string]: unknown;
}> & {
  folder_path?: string;
};

export type DashboardExportFormat = "png" | "pdf";

export interface DashboardVisualMetrics {
  period_label: string;
  generated_at: string;
  month_income: number;
  month_expense: number;
  month_balance: number;
  active_credits: number;
  pending_installments: number;
  monthly_due_amount: number;
  bills_count: number;
  overdue_bills_count: number;
  due_soon_bills_count: number;
  month_bills_amount: number;
  categories_count: number;
}

export type DashboardChartExportResult = ApiResponse<{
  file_path?: string;
  file_name?: string;
  format?: DashboardExportFormat;
  section?: string;
  [key: string]: unknown;
}> & {
  file_path?: string;
  file_name?: string;
  format?: DashboardExportFormat;
  section?: string;
};
