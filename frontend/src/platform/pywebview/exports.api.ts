import { getBolsiApi } from "./pywebview";
import type {
  DashboardChartExportResult,
  DashboardVisualMetrics,
  ExportFormat,
  ExportSection,
  GenerateExportResult,
} from "./exports.api.types";

export async function generateExport(
  userId: number,
  section: ExportSection = "summary",
  exportFormat: ExportFormat = "csv",
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_generate(userId, section, exportFormat);
}

export async function exportCsv(
  userId: number,
  section: ExportSection = "summary",
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_csv(userId, section);
}

export async function exportPdf(
  userId: number,
  section: ExportSection = "summary",
): Promise<GenerateExportResult> {
  const api = await getBolsiApi();
  return api.exports_pdf(userId, section);
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
    metrics.categories_count,
  );
}
