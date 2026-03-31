import { getBolsiApi } from "./pywebview";
import type {
  DashboardChartExportResult,
  DashboardVisualMetrics,
  ExportFormat,
  ExportSection,
  GenerateExportResult,
  OpenExportFolderResult,
} from "./exports.api.types";

type TransactionPeriodFilter = {
  year?: number;
  month?: number;
  fromDate?: string;
};

export async function generateExport(
  userId: number,
  section: ExportSection = "summary",
  exportFormat: ExportFormat = "xlsx",
  periodFilter?: TransactionPeriodFilter,
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_generate(
    userId,
    section,
    exportFormat,
    periodFilter?.year,
    periodFilter?.month,
    periodFilter?.fromDate,
  );
}

export async function exportExcel(
  userId: number,
  section: ExportSection = "summary",
  periodFilter?: TransactionPeriodFilter,
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_excel(
    userId,
    section,
    periodFilter?.year,
    periodFilter?.month,
    periodFilter?.fromDate,
  );
}

export async function exportPdf(
  userId: number,
  section: ExportSection = "summary",
  periodFilter?: TransactionPeriodFilter,
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_pdf(
    userId,
    section,
    periodFilter?.year,
    periodFilter?.month,
    periodFilter?.fromDate,
  );
}

export async function openExportsFolder(
  userId: number,
): Promise<OpenExportFolderResult> {
  const api = await getBolsiApi();
  return api.exports_open_folder(userId);
}

export async function exportDashboardChartPng(
  userId: number,
  imageDataUrl: string,
): Promise<DashboardChartExportResult> {
  const api = await getBolsiApi();
  return api.exports_dashboard_chart_png(userId, imageDataUrl);
}

export async function exportDashboardVisualPdf(
  userId: number,
  imageDataUrl: string,
  metrics: DashboardVisualMetrics,
): Promise<DashboardChartExportResult> {
  const api = await getBolsiApi();
  return api.exports_dashboard_visual_pdf(
    userId,
    imageDataUrl,
    metrics.period_label,
    metrics.generated_at,
    metrics.month_income,
    metrics.month_expense,
    metrics.month_balance,
    metrics.active_credits,
    metrics.pending_installments,
    metrics.monthly_due_amount,
    metrics.bills_count,
    metrics.overdue_bills_count,
    metrics.due_soon_bills_count,
    metrics.month_bills_amount,
    metrics.categories_count,
  );
}
