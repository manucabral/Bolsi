import { useState } from "preact/hooks";
import { exportCsv, exportPdf } from "../../../platform/pywebview/exports.api";
import type {
  ExportFormat,
  ExportSection,
} from "../../../platform/pywebview/exports.api.types";

type ExportNotice = {
  kind: "success" | "error";
  message: string;
};

type SectionExportActionsProps = {
  userId: number;
  section: ExportSection;
  disabled?: boolean;
  onNotice?: (notice: ExportNotice) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

export function SectionExportActions({
  userId,
  section,
  disabled = false,
  onNotice,
}: SectionExportActionsProps) {
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);

  async function runExport(format: ExportFormat) {
    if (!userId) {
      onNotice?.({
        kind: "error",
        message: "Sesion invalida.",
      });
      return;
    }

    setIsExporting(format);

    try {
      const response =
        format === "csv"
          ? await exportCsv(userId, section)
          : await exportPdf(userId, section);

      if (!response.ok) {
        onNotice?.({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName =
        response.data?.file_name ??
        response.file_name ??
        `${section}.${format}`;

      onNotice?.({
        kind: "success",
        message: `${response.message}. Archivo: ${fileName}`,
      });
    } catch (error) {
      onNotice?.({
        kind: "error",
        message: getErrorMessage(error, "No se pudo exportar."),
      });
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void runExport("csv")}
        disabled={disabled || isExporting !== null}
        class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting === "csv" ? "Exportando CSV..." : "Exportar CSV"}
      </button>
      <button
        type="button"
        onClick={() => void runExport("pdf")}
        disabled={disabled || isExporting !== null}
        class="rounded-lg border border-violet-300/35 bg-violet-900/45 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting === "pdf" ? "Exportando PDF..." : "Exportar PDF"}
      </button>
    </div>
  );
}
