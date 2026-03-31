import { useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  exportDashboardChartPng,
  exportExcel,
  openExportsFolder,
  exportPdf,
} from "../../../platform/pywebview/exports.api";
import { listTransactions } from "../../../platform/pywebview/transactions.api";
import { listCredits } from "../../../platform/pywebview/credits.api";
import { listMonthBills } from "../../../platform/pywebview/bills.api";
import { listCategories } from "../../../platform/pywebview/categories.api";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

function getCurrentMonthStartIsoDate() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function buildExportSuccessMessage(
  message: string,
  fileName?: string,
  filePath?: string,
) {
  if (fileName && filePath) {
    return `${message}. Archivo: ${fileName}. Ruta: ${filePath}`;
  }

  if (fileName) {
    return `${message}. Archivo: ${fileName}`;
  }

  return message;
}

function createDashboardSummaryImageDataUrl(
  periodLabel: string,
  monthIncome: number,
  monthExpense: number,
  monthBalance: number,
  activeCredits: number,
  pendingInstallments: number,
  openBillsAmount: number,
  formatAmount: (value: number) => string,
): string {
  const width = 980;
  const height = 460;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo preparar la imagen del dashboard");
  }

  ctx.fillStyle = "#151428";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#d8b4fe";
  ctx.font = "700 30px Segoe UI";
  ctx.fillText("Bolsi - Dashboard", 36, 52);

  ctx.fillStyle = "#c4b5fd";
  ctx.font = "500 16px Segoe UI";
  ctx.fillText(`Periodo: ${periodLabel}`, 36, 82);

  const cards = [
    {
      label: "Ingresos del mes",
      value: formatAmount(monthIncome),
      border: "rgba(45, 212, 191, 0.55)",
      fill: "rgba(20, 184, 166, 0.15)",
      text: "#99f6e4",
    },
    {
      label: "Gastos del mes",
      value: formatAmount(monthExpense),
      border: "rgba(248, 113, 113, 0.55)",
      fill: "rgba(239, 68, 68, 0.15)",
      text: "#fecaca",
    },
    {
      label: "Balance del mes",
      value: formatAmount(monthBalance),
      border: "rgba(147, 197, 253, 0.55)",
      fill: "rgba(59, 130, 246, 0.14)",
      text: "#bfdbfe",
    },
    {
      label: "Saldo facturas pendientes",
      value: formatAmount(openBillsAmount),
      border: "rgba(251, 146, 60, 0.55)",
      fill: "rgba(249, 115, 22, 0.14)",
      text: "#fed7aa",
    },
  ];

  cards.forEach((card, index) => {
    const x = 36 + (index % 2) * 460;
    const y = 112 + Math.floor(index / 2) * 122;

    ctx.fillStyle = card.fill;
    ctx.fillRect(x, y, 428, 98);
    ctx.strokeStyle = card.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 428, 98);

    ctx.fillStyle = "#ddd6fe";
    ctx.font = "600 14px Segoe UI";
    ctx.fillText(card.label, x + 18, y + 30);

    ctx.fillStyle = card.text;
    ctx.font = "700 22px Segoe UI";
    ctx.fillText(card.value, x + 18, y + 68);
  });

  ctx.fillStyle = "rgba(167, 139, 250, 0.2)";
  ctx.fillRect(36, 366, 908, 58);
  ctx.strokeStyle = "rgba(167, 139, 250, 0.5)";
  ctx.strokeRect(36, 366, 908, 58);

  ctx.fillStyle = "#e9d5ff";
  ctx.font = "600 16px Segoe UI";
  ctx.fillText(
    `Creditos activos: ${activeCredits}  |  Cuotas pendientes: ${pendingInstallments}`,
    56,
    402,
  );

  return canvas.toDataURL("image/png");
}

export function ExportsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [transactionsFromDate, setTransactionsFromDate] = useState(
    getCurrentMonthStartIsoDate(),
  );
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useKindNoticeToast(notice, setNotice);

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  async function runExportAction(
    key: string,
    action: () => Promise<{
      ok: boolean;
      message: string;
      error?: string;
      data?: Record<string, unknown>;
      file_name?: string;
      file_path?: string;
    }>,
    fallbackError: string,
  ) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setIsExporting(key);
    setNotice(null);

    try {
      const response = await action();
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName =
        String(response.data?.file_name ?? "") || response.file_name;
      const filePath =
        String(response.data?.file_path ?? "") || response.file_path;

      setNotice({
        kind: "success",
        message: buildExportSuccessMessage(response.message, fileName, filePath),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, fallbackError),
      });
    } finally {
      setIsExporting(null);
    }
  }

  async function exportDashboardPng() {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setIsExporting("dashboard-png");
    setNotice(null);

    try {
      const monthNumber = Number(defaultMonth);
      const yearNumber = Number(defaultYear);

      const [transactionsResponse, creditsResponse, billsResponse, categoriesResponse] =
        await Promise.all([
          listTransactions(userId),
          listCredits(userId),
          listMonthBills(userId, yearNumber, monthNumber),
          listCategories(userId),
        ]);

      if (!transactionsResponse.ok) {
        throw new Error(transactionsResponse.error ?? transactionsResponse.message);
      }

      if (!creditsResponse.ok) {
        throw new Error(creditsResponse.error ?? creditsResponse.message);
      }

      if (!billsResponse.ok) {
        throw new Error(billsResponse.error ?? billsResponse.message);
      }

      if (!categoriesResponse.ok) {
        throw new Error(categoriesResponse.error ?? categoriesResponse.message);
      }

      const transactions = transactionsResponse.data?.transactions ?? [];
      const monthIncome = transactions
        .filter(
          (transaction) =>
            transaction.type === "income" &&
            transaction.date.slice(0, 4) === defaultYear &&
            transaction.date.slice(5, 7) === defaultMonth,
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      const monthExpense = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.date.slice(0, 4) === defaultYear &&
            transaction.date.slice(5, 7) === defaultMonth,
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      const monthBalance = monthIncome - monthExpense;

      const credits = creditsResponse.data?.credits ?? [];
      const activeCredits = credits.filter(
        (credit) => Number(credit.paid_installments) < Number(credit.installments),
      );
      const pendingInstallments = activeCredits.reduce(
        (sum, credit) =>
          sum + (Number(credit.installments) - Number(credit.paid_installments)),
        0,
      );

      const bills = billsResponse.data?.bills ?? [];
      const openBillsAmount = bills.reduce(
        (sum, bill) =>
          sum + Math.max(Number(bill.remaining_amount ?? bill.amount) || 0, 0),
        0,
      );

      const periodLabel = new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
      }).format(new Date(Number(defaultYear), Number(defaultMonth) - 1, 1));

      const imageDataUrl = createDashboardSummaryImageDataUrl(
        periodLabel,
        monthIncome,
        monthExpense,
        monthBalance,
        activeCredits.length,
        pendingInstallments,
        openBillsAmount,
        (value) => money.format(value),
      );

      const response = await exportDashboardChartPng(userId, imageDataUrl);

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName =
        String(response.data?.file_name ?? "") || response.file_name;
      const filePath =
        String(response.data?.file_path ?? "") || response.file_path;

      setNotice({
        kind: "success",
        message: buildExportSuccessMessage(response.message, fileName, filePath),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(
          error,
          "No se pudo exportar el grafico del dashboard.",
        ),
      });
    } finally {
      setIsExporting(null);
    }
  }

  return (
    <DashboardLayout
      title="Exportar datos"
      subtitle="Descarga tu información en el formato que necesites."
    >
      <div class="mb-3 flex justify-end">
        <button
          type="button"
          disabled={isExporting !== null}
          onClick={() =>
            void runExportAction(
              "open-folder",
              () => openExportsFolder(userId),
              "No se pudo abrir la carpeta de exportaciones.",
            )
          }
          class="rounded-lg border border-violet-300/35 bg-violet-900/35 px-3 py-2 text-sm font-medium text-violet-100 transition hover:bg-violet-800/45 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting === "open-folder"
            ? "Abriendo carpeta..."
            : "Ver carpeta de exportaciones"}
        </button>
      </div>

      <section class="rounded-2xl border border-violet-300/20 bg-black/30 p-4">
        <h3 class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
          Dashboard
        </h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "dashboard-xlsx",
                () => exportExcel(userId, "summary"),
                "No se pudo exportar el dashboard en Excel.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "dashboard-xlsx" ? "Exportando Excel..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "dashboard-pdf",
                () => exportPdf(userId, "summary"),
                "No se pudo exportar el dashboard en PDF.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "dashboard-pdf" ? "Exportando PDF..." : "Exportar PDF"}
          </button>
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() => void exportDashboardPng()}
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "dashboard-png"
              ? "Exportando grafico PNG..."
              : "Exportar grafico PNG"}
          </button>
        </div>
      </section>

      <section class="mt-3 rounded-2xl border border-violet-300/20 bg-black/30 p-4">
        <h3 class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
          Transacciones
        </h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "transactions-xlsx",
                () =>
                  exportExcel(userId, "transactions", {
                    fromDate: transactionsFromDate,
                  }),
                "No se pudo exportar transacciones en Excel.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "transactions-xlsx" ? "Exportando Excel..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "transactions-pdf",
                () =>
                  exportPdf(userId, "transactions", {
                    fromDate: transactionsFromDate,
                  }),
                "No se pudo exportar transacciones en PDF.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "transactions-pdf" ? "Exportando PDF..." : "Exportar PDF"}
          </button>
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-3">
          <label class="grid gap-1 text-xs text-violet-200/80">
            Desde
            <input
              type="date"
              value={transactionsFromDate}
              onInput={(event) => setTransactionsFromDate(event.currentTarget.value)}
              class="rounded-md border border-violet-300/25 bg-violet-950/35 px-2 py-1.5 text-sm text-violet-100"
            />
          </label>

          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() => setTransactionsFromDate(getCurrentMonthStartIsoDate())}
            class="rounded-md border border-violet-300/25 bg-black/20 px-3 py-2 text-xs font-medium text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mes actual
          </button>

          <p class="text-xs text-violet-300/80">
            Por defecto se exporta desde el inicio del mes actual.
          </p>
        </div>
      </section>

      <section class="mt-3 rounded-2xl border border-violet-300/20 bg-black/30 p-4">
        <h3 class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
          Creditos
        </h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "credits-xlsx",
                () => exportExcel(userId, "credits"),
                "No se pudo exportar creditos en Excel.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "credits-xlsx" ? "Exportando Excel..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "credits-pdf",
                () => exportPdf(userId, "credits"),
                "No se pudo exportar creditos en PDF.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "credits-pdf" ? "Exportando PDF..." : "Exportar PDF"}
          </button>
        </div>
      </section>

      <section class="mt-3 rounded-2xl border border-violet-300/20 bg-black/30 p-4">
        <h3 class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
          Facturas
        </h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "bills-xlsx",
                () => exportExcel(userId, "bills"),
                "No se pudo exportar facturas en Excel.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "bills-xlsx" ? "Exportando Excel..." : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={isExporting !== null}
            onClick={() =>
              void runExportAction(
                "bills-pdf",
                () => exportPdf(userId, "bills"),
                "No se pudo exportar facturas en PDF.",
              )
            }
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting === "bills-pdf" ? "Exportando PDF..." : "Exportar PDF"}
          </button>
        </div>
      </section>
    </DashboardLayout>
  );
}
