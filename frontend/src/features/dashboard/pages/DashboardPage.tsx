import { useEffect, useMemo, useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { listMonthBills } from "../../../platform/pywebview/bills.api";
import type { BillItem, BillStatus } from "../../../platform/pywebview/bills.api.types";
import { listCredits } from "../../../platform/pywebview/credits.api";
import type { CreditItem } from "../../../platform/pywebview/credits.api.types";
import { listNotes } from "../../../platform/pywebview/notes.api";
import type { NoteItem } from "../../../platform/pywebview/notes.api.types";
import { listTransactions } from "../../../platform/pywebview/transactions.api";
import type { TransactionItem } from "../../../platform/pywebview/transactions.api.types";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  FinanceTrendChart,
  type FinanceTrendPoint,
} from "../components/FinanceTrendChart";
import { MonthlyCompositionChart } from "../components/MonthlyCompositionChart";
import { useStringNoticeToast } from "../../../shared/ui/useToastNotice";

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

type UiBill = {
  id: number;
  name: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: BillStatus;
  daysUntilDue: number | null;
};

type UiNote = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
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
      <header>
        <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">{label}</p>
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

function isUserNotFoundMessage(value: string | undefined) {
  if (!value) return false;
  return value.toLowerCase().includes("usuario no encontrado");
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateLabel(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function relativeDateLabel(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return formatDateLabel(value);

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  const diffInDays = Math.round(
    (startOfNow.getTime() - startOfDate.getTime()) / oneDay,
  );

  if (diffInDays === 0) return "Hoy";
  if (diffInDays === 1) return "Ayer";
  return formatDateLabel(value);
}

function greetingByHour(username: string) {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return `Buenos días, ${username} ☀️`;
  }

  if (hour >= 12 && hour < 19) {
    return `Buenas tardes, ${username}`;
  }

  return `Buenas noches, ${username}`;
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

function mapBill(item: BillItem): UiBill {
  const amount = Number(item.amount);
  const paidAmountRaw = Number(item.paid_amount ?? 0);
  const paidAmount = Number.isFinite(paidAmountRaw)
    ? Math.min(Math.max(paidAmountRaw, 0), amount)
    : 0;
  const remainingAmountRaw = Number(item.remaining_amount);
  const remainingAmount =
    Number.isFinite(remainingAmountRaw) && remainingAmountRaw >= 0
      ? remainingAmountRaw
      : Math.max(amount - paidAmount, 0);

  return {
    id: item.id,
    name: item.name?.trim() || "Factura",
    amount,
    paidAmount,
    remainingAmount,
    dueDate: item.due_date,
    status: item.status,
    daysUntilDue:
      typeof item.days_until_due === "number" ? item.days_until_due : null,
  };
}

function mapNote(item: NoteItem): UiNote {
  return {
    id: item.id,
    title: item.title?.trim() || "Sin titulo",
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function billStatusLabel(status: BillStatus) {
  if (status === "paid") return "Pagada";
  if (status === "overdue") return "Vencida";
  return "Pendiente";
}

function billStatusBadgeClass(status: BillStatus) {
  if (status === "paid") {
    return "border-teal-300/45 bg-teal-400/15 text-teal-100";
  }
  if (status === "overdue") {
    return "border-red-300/45 bg-red-400/20 text-red-100";
  }
  return "border-sky-300/45 bg-sky-300/15 text-sky-100";
}

function billDueHint(bill: UiBill) {
  if (bill.status === "paid") {
    return "Pagada";
  }

  const days = bill.daysUntilDue;
  if (typeof days !== "number") {
    return "Sin informacion de vencimiento";
  }

  if (days < 0) {
    const daysLate = Math.abs(days);
    return daysLate === 1 ? "Vencio hace 1 dia" : `Vencio hace ${daysLate} dias`;
  }

  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence en 1 dia";
  return `Vence en ${days} dias`;
}

export function DashboardPage() {
  const { session, logout } = useAuth();
  const username = session?.username ?? "Usuario";
  const userId = session?.user_id ?? 0;

  const [transactions, setTransactions] = useState<UiTransaction[]>([]);
  const [credits, setCredits] = useState<UiCredit[]>([]);
  const [bills, setBills] = useState<UiBill[]>([]);
  const [notes, setNotes] = useState<UiNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useStringNoticeToast(notice, setNotice);

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
      setBills([]);
      setNotes([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [
          transactionsResponse,
          creditsResponse,
          billsResponse,
          notesResponse,
        ] =
          await Promise.all([
            listTransactions(userId),
            listCredits(userId),
            listMonthBills(userId),
            listNotes(userId),
          ]);

        if (!isMounted) return;

        if (!transactionsResponse.ok) {
          const message = transactionsResponse.error ?? transactionsResponse.message;
          if (isUserNotFoundMessage(message)) {
            await logout();
            return;
          }
          setTransactions([]);
          setNotice(message);
        } else {
          const rows = transactionsResponse.data?.transactions ?? [];
          const mappedTransactions = rows.map(mapTransaction);
          setTransactions(filterVisibleTransactions(mappedTransactions));
        }

        if (!creditsResponse.ok) {
          const message = creditsResponse.error ?? creditsResponse.message;
          if (isUserNotFoundMessage(message)) {
            await logout();
            return;
          }
          setCredits([]);
          setNotice((previous) => previous ?? message);
        } else {
          const rows = creditsResponse.data?.credits ?? [];
          setCredits(rows.map(mapCredit));
        }

        if (!billsResponse.ok) {
          const message = billsResponse.error ?? billsResponse.message;
          if (isUserNotFoundMessage(message)) {
            await logout();
            return;
          }
          setBills([]);
          setNotice((previous) => previous ?? message);
        } else {
          const rows = billsResponse.data?.bills ?? [];
          setBills(rows.map(mapBill));
        }

        if (!notesResponse.ok) {
          const message = notesResponse.error ?? notesResponse.message;
          if (isUserNotFoundMessage(message)) {
            await logout();
            return;
          }
          setNotes([]);
          setNotice((previous) => previous ?? message);
        } else {
          const rows = notesResponse.data?.notes ?? [];
          setNotes(rows.map(mapNote));
        }
      } catch (error) {
        if (!isMounted) return;
        setTransactions([]);
        setCredits([]);
        setBills([]);
        setNotes([]);
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
  }, [userId, logout]);

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
  const currentYear = String(now.getFullYear());

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

  const pendingBills = useMemo(
    () => bills.filter((bill) => bill.status === "pending"),
    [bills],
  );

  const overdueBills = useMemo(
    () => bills.filter((bill) => bill.status === "overdue"),
    [bills],
  );

  const openBills = useMemo(
    () => bills.filter((bill) => bill.status !== "paid"),
    [bills],
  );

  const dueSoonBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          bill.status === "pending" &&
          typeof bill.daysUntilDue === "number" &&
          bill.daysUntilDue >= 0 &&
          bill.daysUntilDue <= 3,
      ),
    [bills],
  );

  const openBillsAmount = useMemo(
    () => openBills.reduce((sum, bill) => sum + bill.remainingAmount, 0),
    [openBills],
  );

  const highlightedBills = useMemo(
    () =>
      [...bills]
        .sort((a, b) => {
          const rankA = a.status === "paid" ? 1 : 0;
          const rankB = b.status === "paid" ? 1 : 0;
          const byStatus = rankA - rankB;
          if (byStatus !== 0) return byStatus;

          const byDate = a.dueDate.localeCompare(b.dueDate);
          if (byDate !== 0) return byDate;
          return a.id - b.id;
        })
        .slice(0, 6),
    [bills],
  );

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => {
          const byUpdated = b.updatedAt.localeCompare(a.updatedAt);
          if (byUpdated !== 0) return byUpdated;
          return b.id - a.id;
        })
        .slice(0, 3),
    [notes],
  );

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

  return (
    <DashboardLayout
      title={greetingByHour(username)}
      subtitle="Resumen de tus finanzas."
    >
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <article class={primaryCardClass}>
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Ingresos del mes
            </p>
            <span class="h-2.5 w-2.5 rounded-full bg-teal-300/85" />
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
            <span class="h-2.5 w-2.5 rounded-full bg-red-300/85" />
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
          </div>
          <p
            class={[
              "mt-2 text-2xl font-semibold",
              monthBalance < 0 ? "text-red-300" : "text-teal-300",
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
          valueClassName="text-teal-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Cuotas pendientes"
          value={pendingInstallments}
          hint="Pendientes por pagar"
          valueClassName="text-red-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Cuotas a pagar este mes"
          value={money.format(monthlyDueAmount)}
          hint="Total estimado mensual"
          compact
          valueClassName="text-red-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Saldo facturas pendientes"
          value={money.format(openBillsAmount)}
          hint={`${openBills.length} abiertas`}
          compact
          valueClassName="text-red-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Facturas vencidas"
          value={overdueBills.length}
          hint={`${pendingBills.length} pendientes`}
          valueClassName="text-red-300"
        />

        <SecondaryMetricCard
          className={secondaryCardClass}
          label="Vencen pronto"
          value={dueSoonBills.length}
          hint="Proximas 72 horas"
          valueClassName="text-sky-300"
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
          />
        </article>

        <MonthlyCompositionChart
          income={monthIncome}
          expense={monthExpense}
          formatAmount={(value) => money.format(value)}
        />
      </section>

      <div class="mt-5 grid min-w-0 gap-3 xl:grid-cols-2">
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
                            signedAmount < 0 ? "text-red-300" : "text-teal-300",
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
                                ? "text-red-300"
                                : "text-teal-300",
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
                        class="h-full rounded-full bg-linear-to-r from-violet-400 to-red-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article class="min-w-0 rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
                Facturas y vencimientos
              </p>
              <p class="text-xs text-violet-300/80">
                Pendientes y vencidas siempre visibles; pagadas del mes actual.
              </p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {bills.length}
            </span>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Cargando facturas...
            </p>
          ) : highlightedBills.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              No hay facturas activas ni pagadas este mes.
            </p>
          ) : (
            <div class="mt-3 grid gap-2 sm:grid-cols-2">
              {highlightedBills.map((bill) => (
                <article
                  key={bill.id}
                  class={[
                    "rounded-lg border border-violet-300/20 bg-violet-950/25 p-3",
                    highlightedBills.length === 1 ? "sm:col-span-2" : "",
                  ].join(" ")}
                >
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium text-violet-100">{bill.name}</p>
                    <span
                      class={[
                        "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em]",
                        billStatusBadgeClass(bill.status),
                      ].join(" ")}
                    >
                      {billStatusLabel(bill.status)}
                    </span>
                  </div>

                  <p class="mt-2 text-lg font-semibold text-red-300">
                    {money.format(bill.remainingAmount)}
                  </p>

                  {bill.remainingAmount < bill.amount ? (
                    <p class="mt-1 text-xs text-violet-300/75">
                      Total {money.format(bill.amount)} · Abonado {money.format(bill.paidAmount)}
                    </p>
                  ) : null}

                  <p class="mt-1 text-xs text-violet-300/80">
                    Vence {formatShortDate(bill.dueDate)} · {billDueHint(bill)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article class="min-w-0 rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.08em] text-violet-200">
                Notas recientes
              </p>
              <p class="text-xs text-violet-300/80">
                Ultimas notas creadas o editadas.
              </p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {recentNotes.length}
            </span>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Cargando notas...
            </p>
          ) : recentNotes.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
              Todavia no hay notas.
            </p>
          ) : (
            <div class="mt-3 space-y-2">
              {recentNotes.map((note) => {
                const wasEdited = note.updatedAt !== note.createdAt;

                return (
                  <article
                    key={note.id}
                    class="rounded-lg border border-violet-300/20 bg-violet-950/25 px-3 py-2.5"
                  >
                    <p class="text-sm font-medium text-violet-100">{note.title}</p>
                    <p class="mt-1 text-xs text-violet-300/80">
                      {wasEdited ? "Editada" : "Creada"} {relativeDateLabel(
                        wasEdited ? note.updatedAt : note.createdAt,
                      )}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </DashboardLayout>
  );
}


