import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { listCategories } from "../../../platform/pywebview/categories.api";
import type { CategoryItem } from "../../../platform/pywebview/categories.api.types";
import { listCredits } from "../../../platform/pywebview/credits.api";
import type { CreditItem } from "../../../platform/pywebview/credits.api.types";
import { listTransactions } from "../../../platform/pywebview/transactions.api";
import type { TransactionItem } from "../../../platform/pywebview/transactions.api.types";
import {
  exportCsv,
  exportDashboardChartPng as exportDashboardChartPngFile,
  exportDashboardVisualPdf,
} from "../../../platform/pywebview/exports.api";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  FinanceTrendChart,
  type FinanceTrendPoint,
} from "../components/FinanceTrendChart";
import { MonthlyCompositionChart } from "../components/MonthlyCompositionChart";
import {
  useKindNoticeToast,
  useStringNoticeToast,
} from "../../../shared/ui/useToastNotice";

type UiTransaction = {
  id: number;
  date: string;
  description: string;
  categoryName: string;
  type: "income" | "expense";
  amount: number;
  creditId: number | null;
  fromInstallment: boolean;
};

type UiCredit = {
  id: number;
  description: string;
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: number;
  firstInstallmentDate: string;
};

type SecondaryMetricCardProps = {
  className: string;
  label: string;
  value: string | number;
  hint?: string;
  compact?: boolean;
  valueClassName?: string;
};

function SecondaryMetricCard({
  className,
  label,
  value,
  hint,
  compact = false,
  valueClassName,
}: SecondaryMetricCardProps) {
  return (
    <article class={className}>
      <header class="flex items-center justify-between gap-2">
        <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">{label}</p>
        <div class="flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-300/85" />
          <span class="h-2.5 w-2.5 rounded-full bg-rose-300/85" />
        </div>
      </header>

      <p
        class={[
          "mt-2 font-semibold",
          compact ? "text-xl" : "text-2xl",
          valueClassName ?? "text-violet-100",
        ].join(" ")}
      >
        {value}
      </p>

      {hint ? (
        <p class="mt-1 text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
          {hint}
        </p>
      ) : null}
    </article>
  );
}

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date;
}

function toYearMonth(value: Date) {
  const year = String(value.getFullYear());
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function createCompositionChartImageDataUrl(
  income: number,
  expense: number,
  periodLabel: string,
  formatAmount: (value: number) => string,
): string {
  const width = 980;
  const height = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const total = income + expense;
  const incomeRatio = total > 0 ? income / total : 0;

  ctx.fillStyle = "#151428";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#d8b4fe";
  ctx.font = "600 22px Segoe UI";
  ctx.fillText("Composicion del mes", 40, 44);
  ctx.fillStyle = "#c4b5fd";
  ctx.font = "400 14px Segoe UI";
  ctx.fillText(`Periodo ${periodLabel}`, 40, 68);

  const centerX = 210;
  const centerY = 186;
  const radius = 84;
  const ringWidth = 34;

  ctx.lineWidth = ringWidth;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(109, 40, 217, 0.35)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  if (total > 0) {
    const startAngle = -Math.PI / 2;
    const incomeAngle = startAngle + Math.PI * 2 * incomeRatio;

    ctx.strokeStyle = "#34d399";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, incomeAngle);
    ctx.stroke();

    ctx.strokeStyle = "#fb7185";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, incomeAngle, startAngle + Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#e9d5ff";
  ctx.textAlign = "center";
  ctx.font = "500 11px Segoe UI";
  ctx.fillText("TOTAL", centerX, centerY - 12);
  ctx.font = "600 14px Segoe UI";
  ctx.fillText(formatAmount(total), centerX, centerY + 10);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(52, 211, 153, 0.2)";
  ctx.fillRect(390, 108, 520, 74);
  ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
  ctx.strokeRect(390, 108, 520, 74);
  ctx.fillStyle = "#bbf7d0";
  ctx.font = "600 13px Segoe UI";
  ctx.fillText("Ingresos", 412, 134);
  ctx.font = "700 18px Segoe UI";
  ctx.fillText(formatAmount(income), 412, 164);

  ctx.fillStyle = "rgba(251, 113, 133, 0.2)";
  ctx.fillRect(390, 198, 520, 74);
  ctx.strokeStyle = "rgba(251, 113, 133, 0.45)";
  ctx.strokeRect(390, 198, 520, 74);
  ctx.fillStyle = "#fecdd3";
  ctx.font = "600 13px Segoe UI";
  ctx.fillText("Gastos", 412, 224);
  ctx.font = "700 18px Segoe UI";
  ctx.fillText(formatAmount(expense), 412, 254);

  return canvas.toDataURL("image/png");
}

function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo preparar la imagen para exportación"));
    image.src = dataUrl;
  });
}

async function combineDashboardChartsImage(
  trendDataUrl: string,
  compositionDataUrl: string,
): Promise<string> {
  const [trendImage, compositionImage] = await Promise.all([
    dataUrlToImage(trendDataUrl),
    dataUrlToImage(compositionDataUrl),
  ]);

  const padding = 24;
  const sectionGap = 20;
  const sectionWidth = Math.max(trendImage.width, compositionImage.width);
  const canvas = document.createElement("canvas");
  canvas.width = sectionWidth + padding * 2;
  canvas.height =
    padding * 2 +
    trendImage.height +
    sectionGap +
    compositionImage.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el lienzo de exportación");

  ctx.fillStyle = "#151428";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const trendX = padding + (sectionWidth - trendImage.width) / 2;
  const compositionX = padding + (sectionWidth - compositionImage.width) / 2;
  const trendY = padding;
  const compositionY = padding + trendImage.height + sectionGap;

  ctx.drawImage(trendImage, trendX, trendY);
  ctx.drawImage(compositionImage, compositionX, compositionY);

  return canvas.toDataURL("image/png");
}

function getNextInstallmentDate(credit: UiCredit) {
  if (credit.paidInstallments >= credit.totalInstallments) {
    return null;
  }
  return toISODate(addMonths(credit.firstInstallmentDate, credit.paidInstallments));
}

function mapTransaction(item: TransactionItem): UiTransaction {
  return {
    id: item.id,
    date: item.date,
    description: item.description?.trim() || "Sin descripción",
    categoryName: item.category_name?.trim() || "Sin categoría",
    type: item.type,
    amount: item.amount,
    creditId: item.credit_id ?? null,
    fromInstallment: item.credit_id !== null && item.credit_id !== undefined,
  };
}

function filterVisibleTransactions(transactions: UiTransaction[]) {
  const manualTransactions: UiTransaction[] = [];
  const firstInstallmentByCredit = new Map<number, UiTransaction>();

  for (const transaction of transactions) {
    if (!transaction.fromInstallment || transaction.creditId === null) {
      manualTransactions.push(transaction);
      continue;
    }

    const currentFirst = firstInstallmentByCredit.get(transaction.creditId);
    if (!currentFirst || transaction.id < currentFirst.id) {
      firstInstallmentByCredit.set(transaction.creditId, transaction);
    }
  }

  return [...manualTransactions, ...firstInstallmentByCredit.values()].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.id - a.id;
  });
}

function mapCredit(item: CreditItem): UiCredit {
  return {
    id: item.id,
    description: item.description,
    totalInstallments: item.installments,
    paidInstallments: Math.min(item.paid_installments, item.installments),
    installmentAmount: item.installment_amount,
    firstInstallmentDate: item.start_date,
  };
}

export function DashboardPage() {
  const { session } = useAuth();
  const username = session?.username ?? "Usuario";
  const userId = session?.user_id ?? 0;

  const [transactions, setTransactions] = useState<UiTransaction[]>([]);
  const [credits, setCredits] = useState<UiCredit[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [chartExporting, setChartExporting] = useState<
    "csv" | "png" | "pdf" | null
  >(null);
  const trendChartCaptureRef = useRef<(() => string | null) | null>(null);

  useStringNoticeToast(notice, setNotice);
  useKindNoticeToast(exportNotice, setExportNotice);

  const primaryCardClass =
    "rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)] sm:col-span-2 xl:col-span-2";
  const secondaryCardClass =
    "rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)] xl:col-span-3";

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setCredits([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [transactionsResponse, creditsResponse, categoriesResponse] =
          await Promise.all([
            listTransactions(userId),
            listCredits(userId),
            listCategories(userId),
          ]);

        if (!isMounted) return;

        if (!transactionsResponse.ok) {
          setTransactions([]);
          setNotice(transactionsResponse.error ?? transactionsResponse.message);
        } else {
          const rows = transactionsResponse.data?.transactions ?? [];
          const mappedTransactions = rows.map(mapTransaction);
          setTransactions(filterVisibleTransactions(mappedTransactions));
        }

        if (!creditsResponse.ok) {
          setCredits([]);
          setNotice((previous) => previous ?? (creditsResponse.error ?? creditsResponse.message));
        } else {
          const rows = creditsResponse.data?.credits ?? [];
          setCredits(rows.map(mapCredit));
        }

        if (!categoriesResponse.ok) {
          setCategories([]);
          setNotice((previous) => previous ?? (categoriesResponse.error ?? categoriesResponse.message));
        } else {
          setCategories(categoriesResponse.data?.categories ?? []);
        }
      } catch (error) {
        if (!isMounted) return;
        setTransactions([]);
        setCredits([]);
        setCategories([]);
        setNotice(
          toUiErrorMessage(error, "No se pudieron cargar los datos del dashboard."),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());
  const currentPeriodLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
      }).format(new Date(Number(currentYear), Number(currentMonth) - 1, 1)),
    [currentMonth, currentYear],
  );

  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.date.slice(0, 4) === currentYear &&
          transaction.date.slice(5, 7) === currentMonth,
      ),
    [transactions, currentMonth, currentYear],
  );

  const monthIncome = useMemo(
    () =>
      monthTransactions
        .filter((transaction) => transaction.type === "income")
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions],
  );

  const monthExpense = useMemo(
    () =>
      monthTransactions
        .filter((transaction) => transaction.type === "expense")
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions],
  );

  const monthBalance = monthIncome - monthExpense;

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => {
          const byDate = b.date.localeCompare(a.date);
          if (byDate !== 0) return byDate;
          return b.id - a.id;
        })
        .slice(0, 6),
    [transactions],
  );

  const activeCredits = useMemo(
    () => credits.filter((credit) => credit.paidInstallments < credit.totalInstallments),
    [credits],
  );

  const pendingInstallments = useMemo(
    () =>
      activeCredits.reduce(
        (sum, credit) => sum + (credit.totalInstallments - credit.paidInstallments),
        0,
      ),
    [activeCredits],
  );

  const monthlyDueAmount = useMemo(() => {
    const month = now.getMonth();
    const year = now.getFullYear();

    return activeCredits.reduce((sum, credit) => {
      const nextDate = getNextInstallmentDate(credit);
      if (!nextDate) return sum;

      const due = new Date(`${nextDate}T00:00:00`);
      const matchesMonth = due.getMonth() === month && due.getFullYear() === year;
      return matchesMonth ? sum + credit.installmentAmount : sum;
    }, 0);
  }, [activeCredits, now]);

  const trendSeries = useMemo<FinanceTrendPoint[]>(() => {
    const buckets = new Map<string, { income: number; expense: number }>();

    for (const transaction of transactions) {
      const key = transaction.date.slice(0, 7);
      const current = buckets.get(key) ?? { income: 0, expense: 0 };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }

      buckets.set(key, current);
    }

    const baseMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const points: FinanceTrendPoint[] = [];

    for (let index = 5; index >= 0; index -= 1) {
      const monthDate = new Date(baseMonth);
      monthDate.setMonth(baseMonth.getMonth() - index);

      const key = toYearMonth(monthDate);
      const values = buckets.get(key) ?? { income: 0, expense: 0 };

      points.push({
        time: `${key}-01`,
        income: values.income,
        expense: values.expense,
        balance: values.income - values.expense,
      });
    }

    return points;
  }, [transactions, now]);

  const handleTrendChartCaptureReady = useCallback(
    (capture: (() => string | null) | null) => {
      trendChartCaptureRef.current = capture;
    },
    [],
  );

  async function getCombinedDashboardChartsImageDataUrl() {
    const capture = trendChartCaptureRef.current;
    if (!capture) {
      throw new Error("El grafico de tendencia aun no esta listo para exportar.");
    }

    const trendDataUrl = capture();
    if (!trendDataUrl) {
      throw new Error("No se pudo capturar la tendencia financiera.");
    }

    const compositionDataUrl = createCompositionChartImageDataUrl(
      monthIncome,
      monthExpense,
      currentPeriodLabel,
      (value) => money.format(value),
    );

    if (!compositionDataUrl) {
      throw new Error("No se pudo generar la composicion del mes.");
    }

    return combineDashboardChartsImage(trendDataUrl, compositionDataUrl);
  }

  async function exportDashboardCsvSummary() {
    if (!userId) {
      setExportNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setChartExporting("csv");

    try {
      const response = await exportCsv(userId, "summary");

      if (!response.ok) {
        setExportNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName = response.data?.file_name ?? response.file_name ?? "summary.csv";
      const filePath = response.data?.file_path ?? response.file_path;

      setExportNotice({
        kind: "success",
        message: filePath
          ? `${response.message}. Archivo: ${fileName}. Ruta: ${filePath}`
          : `${response.message}. Archivo: ${fileName}`,
      });
    } catch (error) {
      setExportNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo exportar el CSV."),
      });
    } finally {
      setChartExporting(null);
    }
  }

  async function exportDashboardChartPng() {
    if (!userId) {
      setExportNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setChartExporting("png");

    try {
      const imageDataUrl = await getCombinedDashboardChartsImageDataUrl();

      const response = await exportDashboardChartPngFile(userId, imageDataUrl);

      if (!response.ok) {
        setExportNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName =
        response.data?.file_name ??
        response.file_name ??
        "bolsi_dashboard_chart.png";
      const filePath = response.data?.file_path ?? response.file_path;

      setExportNotice({
        kind: "success",
        message: filePath
          ? `${response.message}. Archivo: ${fileName}. Ruta: ${filePath}`
          : `${response.message}. Archivo: ${fileName}`,
      });
    } catch (error) {
      setExportNotice({
        kind: "error",
        message: toUiErrorMessage(
          error,
          "No se pudo exportar los graficos del dashboard en PNG.",
        ),
      });
    } finally {
      setChartExporting(null);
    }
  }

  async function exportDashboardPdfWithChart() {
    if (!userId) {
      setExportNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setChartExporting("pdf");

    try {
      const imageDataUrl = await getCombinedDashboardChartsImageDataUrl();

      const response = await exportDashboardVisualPdf(userId, imageDataUrl, {
        period_label: currentPeriodLabel,
        generated_at: new Intl.DateTimeFormat("es-AR", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date()),
        month_income: monthIncome,
        month_expense: monthExpense,
        month_balance: monthBalance,
        active_credits: activeCredits.length,
        pending_installments: pendingInstallments,
        monthly_due_amount: monthlyDueAmount,
        categories_count: categories.length,
      });

      if (!response.ok) {
        setExportNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const fileName =
        response.data?.file_name ??
        response.file_name ??
        "bolsi_dashboard_visual.pdf";
      const filePath = response.data?.file_path ?? response.file_path;

      setExportNotice({
        kind: "success",
        message: filePath
          ? `${response.message}. Archivo: ${fileName}. Ruta: ${filePath}`
          : `${response.message}. Archivo: ${fileName}`,
      });
    } catch (error) {
      setExportNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo exportar el PDF del dashboard."),
      });
    } finally {
      setChartExporting(null);
    }
  }

  return (
    <DashboardLayout
      sectionTag="Inicio"
      title={`Bienvenido, ${username}`}
      subtitle="Resumen de tus finanzas."
    >
      <section class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
        <div>
          <h3 class="text-sm font-semibold text-violet-100">Acciones del panel</h3>
          <p class="text-xs text-violet-300/85">
            Exporta CSV, grafico PNG y reporte completo con metricas en PDF.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void exportDashboardCsvSummary()}
            disabled={!userId || isLoading || chartExporting !== null}
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chartExporting === "csv" ? "Exportando CSV..." : "Exportar CSV"}
          </button>
          <button
            type="button"
            onClick={() => void exportDashboardChartPng()}
            disabled={!userId || isLoading || chartExporting !== null}
            class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chartExporting === "png" ? "Exportando PNG..." : "Exportar grafico PNG"}
          </button>
          <button
            type="button"
            onClick={() => void exportDashboardPdfWithChart()}
            disabled={!userId || isLoading || chartExporting !== null}
            class="rounded-lg border border-violet-300/35 bg-violet-900/45 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {chartExporting === "pdf" ? "Exportando PDF..." : "Exportar todo en PDF"}
          </button>
        </div>
      </section>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article class={primaryCardClass}>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Ingresos del mes
            </p>
            <span class="h-2.5 w-2.5 rounded-full bg-emerald-300/85" />
          </div>
          <p class="mt-2 text-2xl font-semibold text-violet-100">
            {money.format(monthIncome)}
          </p>
        </article>

        <article class={primaryCardClass}>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Gastos del mes
            </p>
            <span class="h-2.5 w-2.5 rounded-full bg-rose-300/85" />
          </div>
          <p class="mt-2 text-2xl font-semibold text-violet-100">
            {money.format(monthExpense)}
          </p>
        </article>

        <article class={primaryCardClass}>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Balance del mes
            </p>
            <div class="flex items-center gap-1.5">
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-300/85" />
              <span class="h-2.5 w-2.5 rounded-full bg-rose-300/85" />
            </div>
          </div>
          <p
            class={[
              "mt-2 text-2xl font-semibold",
              monthBalance < 0 ? "text-rose-300" : "text-emerald-300",
            ].join(" ")}
          >
            {money.format(monthBalance)}
          </p>
        </article>

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Créditos activos"
          value={activeCredits.length}
          hint={`${credits.length} registrados`}
          valueClassName="text-emerald-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Cuotas pendientes"
          value={pendingInstallments}
          hint="Pendientes por pagar"
          valueClassName="text-rose-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Cuotas a pagar este mes"
          value={money.format(monthlyDueAmount)}
          hint="Total estimado mensual"
          compact
          valueClassName="text-rose-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Categorías creadas"
          value={categories.length}
          hint="Disponibles para organizar"
          valueClassName="text-emerald-300"
        />
      </div>

      <section class="mt-4 grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article class="min-w-0 rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
                Tendencia financiera
              </p>
              <p class="text-xs text-violet-300/80">
                Últimos 6 meses de ingresos, gastos y balance.
              </p>
            </div>
          </header>

          <FinanceTrendChart
            data={trendSeries}
            onCaptureReady={handleTrendChartCaptureReady}
          />
        </article>

        <MonthlyCompositionChart
          income={monthIncome}
          expense={monthExpense}
          formatAmount={(value) => money.format(value)}
        />
      </section>

      <div class="mt-5 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article class="min-w-0 rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
                Últimas transacciones
              </p>
              <p class="text-xs text-violet-300/80">Movimientos recientes del usuario.</p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {recentTransactions.length}
            </span>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Cargando movimientos...
            </p>
          ) : recentTransactions.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Sin transacciones.
            </p>
          ) : (
            <>
              <div class="mt-3 space-y-2 md:hidden">
                {recentTransactions.map((transaction) => {
                  const signedAmount =
                    transaction.type === "income"
                      ? transaction.amount
                      : -transaction.amount;

                  return (
                    <article
                      key={`mobile-${transaction.id}`}
                      class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2.5"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <p class="text-sm font-medium text-violet-100">{transaction.description}</p>
                          <p class="mt-1 text-xs text-violet-300/80">
                            {formatShortDate(transaction.date)} · {transaction.categoryName}
                          </p>
                        </div>
                        <p
                          class={[
                            "text-sm font-semibold",
                            signedAmount < 0 ? "text-rose-300" : "text-emerald-300",
                          ].join(" ")}
                        >
                          {money.format(signedAmount)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div class="mt-3 hidden md:block">
                <table class="w-full table-fixed border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr class="text-left text-xs uppercase tracking-[0.08em] text-violet-300/80">
                      <th class="px-2 font-medium">Fecha</th>
                      <th class="px-2 font-medium">Detalle</th>
                      <th class="px-2 font-medium">Categoría</th>
                      <th class="px-2 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((transaction) => {
                      const signedAmount =
                        transaction.type === "income"
                          ? transaction.amount
                          : -transaction.amount;

                      return (
                        <tr
                          key={transaction.id}
                          class="rounded-lg bg-violet-950/30 text-violet-100"
                        >
                          <td class="rounded-l-lg px-2 py-2">
                            {formatShortDate(transaction.date)}
                          </td>
                          <td class="px-2 py-2 break-words">{transaction.description}</td>
                          <td class="px-2 py-2 text-violet-200/80 break-words">
                            {transaction.categoryName}
                          </td>
                          <td
                            class={[
                              "rounded-r-lg px-2 py-2 text-right font-semibold",
                              signedAmount < 0
                                ? "text-rose-300"
                                : "text-emerald-300",
                            ].join(" ")}
                          >
                            {money.format(signedAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>

        <article class="min-w-0 rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
                Créditos activos
              </p>
              <p class="text-xs text-violet-300/80">Seguimiento de progreso y próximos vencimientos.</p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {activeCredits.length}
            </span>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Cargando créditos...
            </p>
          ) : activeCredits.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              No hay créditos activos.
            </p>
          ) : (
            <div class="mt-3 space-y-3">
              {activeCredits.slice(0, 5).map((credit) => {
                const progress =
                  credit.totalInstallments > 0
                    ? (credit.paidInstallments / credit.totalInstallments) * 100
                    : 0;

                const nextDate = getNextInstallmentDate(credit);

                return (
                  <div key={credit.id} class="rounded-lg bg-violet-950/30 p-3">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-sm font-medium text-violet-100">
                        {credit.description}
                      </p>
                      <p class="text-xs text-violet-300/90">
                        {nextDate ? `Vence ${formatShortDate(nextDate)}` : "Finalizado"}
                      </p>
                    </div>
                    <p class="mt-1 text-xs text-violet-200/80">
                      {credit.paidInstallments}/{credit.totalInstallments} cuotas pagadas
                    </p>
                    <div class="mt-2 h-2 rounded-full bg-violet-900/35">
                      <div
                        class="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </DashboardLayout>
  );
}
