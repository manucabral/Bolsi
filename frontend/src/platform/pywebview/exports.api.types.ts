import type { ApiResponse } from "./user.api.types";

export type ExportFormat = "csv" | "pdf";

export type ExportSection =
  | "summary"
  | "transactions"
  | "credits"
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
