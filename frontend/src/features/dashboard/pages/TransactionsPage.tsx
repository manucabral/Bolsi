import { useEffect, useMemo, useState } from "preact/hooks";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { listCategories } from "../../../platform/pywebview/categories.api";
import type { CategoryItem } from "../../../platform/pywebview/categories.api.types";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from "../../../platform/pywebview/transactions.api";
import {
  FinanceTrendChart,
  type FinanceTrendPoint,
} from "../components/FinanceTrendChart";
import { TransactionCategoryChart } from "../components/TransactionCategoryChart";
import type {
  BackendTransactionType,
  TransactionItem,
} from "../../../platform/pywebview/transactions.api.types";
import { SectionExportActions } from "../components/SectionExportActions";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type NormalizedCategoryType = "income" | "expense" | null;

type UiCategory = CategoryItem & {
  normalizedType: NormalizedCategoryType;
};

type UiTransaction = {
  id: number;
  date: string;
  description: string;
  categoryId: number | null;
  categoryName: string;
  type: BackendTransactionType;
  amount: number;
  creditId: number | null;
  fromInstallment: boolean;
};

type TransactionForm = {
  amount: string;
  type: BackendTransactionType;
  categoryId: string;
  description: string;
  date: string;
};

const MONTHS = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const PAGE_SIZE = 8;

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getTodayIsoDate() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function normalizeCategoryType(value: unknown): NormalizedCategoryType {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === "expense" || normalized === "gasto") return "expense";
  if (normalized === "income" || normalized === "ingreso") return "income";

  return null;
}

function mapTransaction(item: TransactionItem): UiTransaction {
  return {
    id: item.id,
    date: item.date,
    description: item.description?.trim() || "S/D",
    categoryId: item.category_id ?? null,
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

function transactionTypeLabel(type: BackendTransactionType) {
  return type === "income" ? "Ingreso" : "Gasto";
}

export function TransactionsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [transactions, setTransactions] = useState<UiTransaction[]>([]);
  const [categories, setCategories] = useState<UiCategory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useKindNoticeToast(notice, setNotice);

  const [monthFilter, setMonthFilter] = useState(defaultMonth);
  const [yearFilter, setYearFilter] = useState(defaultYear);
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [typeFilter, setTypeFilter] = useState<"todos" | BackendTransactionType>(
    "todos",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionForm>({
    amount: "",
    type: "expense",
    categoryId: "",
    description: "",
    date: getTodayIsoDate(),
  });

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const categoriesByType = useMemo(() => {
    return {
      income: categories.filter((category) => category.normalizedType === "income"),
      expense: categories.filter((category) => category.normalizedType === "expense"),
    };
  }, [categories]);

  const formCategoryOptions = useMemo(() => {
    return form.type === "income"
      ? categoriesByType.income
      : categoriesByType.expense;
  }, [categoriesByType, form.type]);

  const categoriesForFilter = useMemo(() => {
    return Array.from(
      new Set(transactions.map((transaction) => transaction.categoryName)),
    ).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const years = useMemo(() => {
    const yearSet = new Set(
      transactions
        .map((transaction) => transaction.date.slice(0, 4))
        .filter((value) => value.length === 4),
    );
    yearSet.add(defaultYear);
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [transactions, defaultYear]);

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const transactionYear = transaction.date.slice(0, 4);
      const transactionMonth = transaction.date.slice(5, 7);

      const matchMonth = transactionMonth === monthFilter;
      const matchYear = transactionYear === yearFilter;
      const matchCategory =
        categoryFilter === "todas" || transaction.categoryName === categoryFilter;
      const matchType = typeFilter === "todos" || transaction.type === typeFilter;
      const matchSearch =
        normalizedSearch.length === 0 ||
        transaction.description.toLowerCase().includes(normalizedSearch);

      return (
        matchMonth && matchYear && matchCategory && matchType && matchSearch
      );
    });
  }, [
    transactions,
    monthFilter,
    yearFilter,
    categoryFilter,
    typeFilter,
    searchTerm,
  ]);

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expense = filteredTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [filteredTransactions]);

  const transactionTrendSeries = useMemo((): FinanceTrendPoint[] => {
    if (filteredTransactions.length === 0) {
      return [];
    }

    const groupedByDate = new Map<string, { income: number; expense: number }>();
    const ordered = [...filteredTransactions].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.id - b.id;
    });

    for (const transaction of ordered) {
      const current = groupedByDate.get(transaction.date) ?? { income: 0, expense: 0 };

      if (transaction.type === "income") {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }

      groupedByDate.set(transaction.date, current);
    }

    let runningBalance = 0;

    return Array.from(groupedByDate.entries()).map(([time, values]) => {
      runningBalance += values.income - values.expense;

      return {
        time,
        income: values.income,
        expense: values.expense,
        balance: runningBalance,
      };
    });
  }, [filteredTransactions]);

  const transactionCategoryDistribution = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; type: BackendTransactionType; amount: number }
    >();

    for (const transaction of filteredTransactions) {
      const key = `${transaction.type}::${transaction.categoryName}`;
      const current = grouped.get(key) ?? {
        label: transaction.categoryName,
        type: transaction.type,
        amount: 0,
      };

      current.amount += Math.abs(transaction.amount);
      grouped.set(key, current);
    }

    const sorted = Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
    const total = sorted.reduce((sum, item) => sum + item.amount, 0);

    if (total === 0) {
      return [];
    }

    return sorted.slice(0, 6).map((item) => ({
      ...item,
      share: (item.amount / total) * 100,
    }));
  }, [filteredTransactions]);

  const selectedMonthLabel = useMemo(
    () => MONTHS.find((month) => month.value === monthFilter)?.label ?? monthFilter,
    [monthFilter],
  );

  const filteredInstallmentsCount = useMemo(
    () => filteredTransactions.filter((transaction) => transaction.fromInstallment).length,
    [filteredTransactions],
  );

  const filteredManualCount = filteredTransactions.length - filteredInstallmentsCount;

  const averageMovementAmount = useMemo(() => {
    if (filteredTransactions.length === 0) return 0;

    const total = filteredTransactions.reduce(
      (sum, transaction) => sum + Math.abs(transaction.amount),
      0,
    );

    return Math.round(total / filteredTransactions.length);
  }, [filteredTransactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );

  useEffect(() => {
    setPage(1);
  }, [monthFilter, yearFilter, categoryFilter, typeFilter, searchTerm]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedTransactions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, page]);

  const startIndex =
    filteredTransactions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, filteredTransactions.length);

  async function reloadTransactions(currentUserId: number) {
    const response = await listTransactions(currentUserId);
    if (!response.ok) {
      setTransactions([]);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    const rows = response.data?.transactions ?? [];
    const mappedTransactions = rows.map(mapTransaction);
    setTransactions(filterVisibleTransactions(mappedTransactions));
  }

  useEffect(() => {
    if (!userId) {
      setTransactions([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [categoriesResponse, transactionsResponse] = await Promise.all([
          listCategories(userId),
          listTransactions(userId),
        ]);

        if (!isMounted) return;

        if (categoriesResponse.ok) {
          const rows = (categoriesResponse.data?.categories ?? []).map(
            (category) => ({
              ...category,
              normalizedType: normalizeCategoryType(category.type),
            }),
          );
          setCategories(rows);
        } else {
          setCategories([]);
          setNotice({
            kind: "error",
            message: categoriesResponse.error ?? categoriesResponse.message,
          });
        }

        if (transactionsResponse.ok) {
          const rows = transactionsResponse.data?.transactions ?? [];
          const mappedTransactions = rows.map(mapTransaction);
          setTransactions(filterVisibleTransactions(mappedTransactions));
        } else {
          setTransactions([]);
          setNotice({
            kind: "error",
            message: transactionsResponse.error ?? transactionsResponse.message,
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setTransactions([]);
        setCategories([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(
            error,
            "No se pudieron cargar las transacciones.",
          ),
        });
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

  function resetForm() {
    setForm({
      amount: "",
      type: "expense",
      categoryId: categoriesByType.expense[0]
        ? String(categoriesByType.expense[0].id)
        : "",
      description: "",
      date: getTodayIsoDate(),
    });
  }

  function openCreateModal() {
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  }

  function openEditModal(transaction: UiTransaction) {
    if (transaction.fromInstallment) {
      setNotice({
        kind: "error",
        message:
          "Las transacciones generadas por cuotas se editan desde Créditos.",
      });
      return;
    }

    setEditingId(transaction.id);
    setForm({
      amount: String(transaction.amount),
      type: transaction.type,
      categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
      description: transaction.description,
      date: transaction.date,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
  }

  async function saveTransaction(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const parsedAmount = Number(form.amount);
    const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
    const normalizedDescription = form.description.trim();

    if (!validAmount || !normalizedDescription || !form.date) {
      return;
    }

    const categoryId = form.categoryId ? Number(form.categoryId) : undefined;

    setIsSaving(true);
    setNotice(null);

    try {
      if (editingId !== null) {
        const current = transactions.find((transaction) => transaction.id === editingId);
        if (!current) {
          setNotice({
            kind: "error",
            message: "No se encontró la transacción a editar.",
          });
          return;
        }

        const response = await updateTransaction(
          userId,
          editingId,
          parsedAmount,
          form.type,
          categoryId,
          normalizedDescription,
          form.date,
          current.creditId ?? undefined,
        );

        if (!response.ok) {
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        await reloadTransactions(userId);
        setNotice({ kind: "success", message: response.message });
        closeModal();
        return;
      }

      const response = await createTransaction(
        userId,
        parsedAmount,
        form.type,
        categoryId,
        normalizedDescription,
        form.date,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadTransactions(userId);
      setNotice({ kind: "success", message: response.message });
      closeModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo guardar la transacción."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeTransaction(transaction: UiTransaction) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    if (transaction.fromInstallment) {
      setNotice({
        kind: "error",
        message:
          "Las transacciones generadas por cuotas se eliminan desde Créditos.",
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await deleteTransaction(userId, transaction.id);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadTransactions(userId);
      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo eliminar la transacción."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function resetFilters() {
    setMonthFilter(defaultMonth);
    setYearFilter(defaultYear);
    setCategoryFilter("todas");
    setTypeFilter("todos");
    setSearchTerm("");
    setPage(1);
  }

  return (
    <DashboardLayout
      sectionTag="Finanzas"
      title="Transacciones"
      subtitle="Registra y filtra tus movimientos."
    >
      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-emerald-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/90">
            Ingresos ({selectedMonthLabel})
          </p>
          <p class="mt-1 text-xl font-semibold text-emerald-300">
            {money.format(totals.income)}
          </p>
        </article>

        <article class="rounded-2xl border border-rose-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/90">
            Gastos ({selectedMonthLabel})
          </p>
          <p class="mt-1 text-xl font-semibold text-rose-300">
            {money.format(totals.expense)}
          </p>
        </article>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/90">
            Balance
          </p>
          <p
            class={[
              "mt-1 text-xl font-semibold",
              totals.balance < 0 ? "text-rose-300" : "text-emerald-300",
            ].join(" ")}
          >
            {money.format(totals.balance)}
          </p>
        </article>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/90">
            Movimientos filtrados
          </p>
          <p class="mt-1 text-xl font-semibold text-violet-100">
            {filteredTransactions.length}
          </p>
        </article>
      </section>

      <section class="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
          <header>
            <h3 class="text-base font-semibold text-violet-100">Flujo diario del periodo</h3>
            <p class="text-xs text-violet-300/85">
              Evolucion de ingresos, gastos y balance acumulado en {selectedMonthLabel} {yearFilter}.
            </p>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
              Cargando grafico...
            </p>
          ) : transactionTrendSeries.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
              No hay movimientos para graficar con los filtros actuales.
            </p>
          ) : (
            <div class="mt-3">
              <FinanceTrendChart data={transactionTrendSeries} />
            </div>
          )}
        </article>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
          <header>
            <h3 class="text-base font-semibold text-violet-100">Distribucion por categoria</h3>
            <p class="text-xs text-violet-300/85">
              Top de categorias por monto dentro de los filtros actuales.
            </p>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
              Cargando grafico...
            </p>
          ) : transactionCategoryDistribution.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
              No hay datos de categorias para mostrar.
            </p>
          ) : (
            <div class="mt-3">
              <TransactionCategoryChart
                data={transactionCategoryDistribution}
                formatAmount={(value) => money.format(value)}
              />
            </div>
          )}
        </article>
      </section>

      <section class="mt-7 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <aside class="space-y-3">
          <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
            <header>
              <h3 class="text-sm font-semibold text-violet-100">Acciones</h3>
              <p class="text-xs text-violet-300/85">
                Crea movimientos y exporta el período actual.
              </p>
            </header>

            <div class="mt-3 grid gap-2.5">
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!userId || isLoading}
                class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Nueva transacción
              </button>

              <button
                type="button"
                onClick={resetFilters}
                class="rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-200 transition hover:border-violet-300/45 hover:text-violet-100"
              >
                Limpiar filtros
              </button>

              <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 p-2.5">
                <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
                  Exportar movimientos
                </p>
                <SectionExportActions
                  userId={userId}
                  section="transactions"
                  disabled={!userId || isLoading || isSaving}
                  onNotice={setNotice}
                />
              </div>
            </div>
          </article>

          <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
            <h3 class="text-sm font-semibold text-violet-100">Filtros</h3>

            <div class="mt-3 grid gap-2">
              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Buscar
                <input
                  value={searchTerm}
                  onInput={(event) => setSearchTerm(event.currentTarget.value)}
                  type="search"
                  placeholder="Descripción"
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none transition focus:border-violet-300/75"
                />
              </label>

              <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Mes
                  <select
                    value={monthFilter}
                    onChange={(event) => setMonthFilter(event.currentTarget.value)}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Año
                  <select
                    value={yearFilter}
                    onChange={(event) => setYearFilter(event.currentTarget.value)}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Categoría
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.currentTarget.value)}
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                >
                  <option value="todas">Todas</option>
                  {categoriesForFilter.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Tipo
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.currentTarget.value as "todos" | BackendTransactionType,
                    )
                  }
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                >
                  <option value="todos">Todos</option>
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                </select>
              </label>
            </div>
          </article>
        </aside>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
          <header class="flex flex-wrap items-center justify-between gap-2 border-b border-violet-300/15 pb-3">
            <div>
              <h3 class="text-base font-semibold text-violet-100">
                Movimientos del periodo
              </h3>
              <p class="text-xs text-violet-300/85">
                {selectedMonthLabel} {yearFilter} · {filteredTransactions.length} resultados
              </p>
            </div>
          </header>

          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                Manuales
              </p>
              <p class="mt-1 text-sm font-semibold text-violet-100">
                {filteredManualCount}
              </p>
            </div>
            <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                Por cuotas
              </p>
              <p class="mt-1 text-sm font-semibold text-violet-100">
                {filteredInstallmentsCount}
              </p>
            </div>
            <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                Ticket promedio
              </p>
              <p class="mt-1 text-sm font-semibold text-violet-100">
                {money.format(averageMovementAmount)}
              </p>
            </div>
          </div>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
              Cargando transacciones...
            </p>
          ) : (
            <>
              <div class="mt-3 space-y-2 lg:hidden">
                {pagedTransactions.length === 0 ? (
                  <p class="rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/70">
                    Sin resultados.
                  </p>
                ) : (
                  pagedTransactions.map((transaction) => {
                    const signedAmount =
                      transaction.type === "income"
                        ? transaction.amount
                        : -transaction.amount;

                    return (
                      <article
                        key={`mobile-${transaction.id}`}
                        class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-3"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <div>
                            <p class="text-sm font-medium text-violet-100">
                              {transaction.description}
                            </p>
                            <p class="mt-1 text-xs text-violet-300/85">
                              {formatLongDate(transaction.date)} · {transaction.categoryName}
                            </p>
                          </div>
                          <span
                            class={[
                              "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
                              transaction.type === "income"
                                ? "bg-emerald-500/20 text-emerald-200"
                                : "bg-rose-500/20 text-rose-200",
                            ].join(" ")}
                          >
                            {transactionTypeLabel(transaction.type)}
                          </span>
                        </div>

                        <div class="mt-2 flex items-center justify-between gap-2">
                          <p
                            class={[
                              "text-sm font-semibold",
                              signedAmount < 0 ? "text-rose-300" : "text-emerald-300",
                            ].join(" ")}
                          >
                            {money.format(signedAmount)}
                          </p>

                          {transaction.fromInstallment ? (
                            <span class="inline-flex rounded-full border border-violet-300/35 bg-violet-900/40 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-violet-100">
                              Cuota
                            </span>
                          ) : (
                            <div class="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditModal(transaction)}
                                disabled={isSaving}
                                class="rounded-md border border-violet-300/25 bg-black/35 px-2 py-1 text-[11px] text-violet-200"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => void removeTransaction(transaction)}
                                disabled={isSaving}
                                class="rounded-md border border-rose-300/30 bg-black/35 px-2 py-1 text-[11px] text-rose-200"
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>

              <div class="mt-3 hidden lg:block">
                <table class="w-full table-fixed border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr class="text-left text-xs uppercase tracking-[0.08em] text-violet-300/80">
                      <th class="px-2 font-medium">Fecha</th>
                      <th class="px-2 font-medium">Desc.</th>
                      <th class="px-2 font-medium">Categ.</th>
                      <th class="px-2 font-medium">Tipo</th>
                      <th class="px-2 text-right font-medium">Monto</th>
                      <th class="px-2 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTransactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          class="rounded-lg bg-violet-950/25 px-2 py-8 text-center text-sm text-violet-200/70"
                        >
                          Sin resultados.
                        </td>
                      </tr>
                    ) : (
                      pagedTransactions.map((transaction) => {
                        const signedAmount =
                          transaction.type === "income"
                            ? transaction.amount
                            : -transaction.amount;

                        return (
                          <tr
                            key={transaction.id}
                            class="rounded-lg border border-violet-300/15 bg-violet-950/30 text-violet-100 transition hover:border-violet-300/40"
                          >
                            <td class="rounded-l-lg px-2 py-2">
                              {formatShortDate(transaction.date)}
                            </td>
                            <td class="px-2 py-2">
                              <p class="line-clamp-2 break-words">{transaction.description}</p>
                              {transaction.fromInstallment ? (
                                <span class="mt-1 inline-flex rounded-full border border-violet-300/35 bg-violet-900/40 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-violet-100">
                                  Cuota
                                </span>
                              ) : null}
                            </td>
                            <td class="px-2 py-2 text-violet-200/85 break-words">
                              {transaction.categoryName}
                            </td>
                            <td class="px-2 py-2">
                              <span
                                class={[
                                  "inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em]",
                                  transaction.type === "income"
                                    ? "bg-emerald-500/20 text-emerald-200"
                                    : "bg-rose-500/20 text-rose-200",
                                ].join(" ")}
                              >
                                {transactionTypeLabel(transaction.type)}
                              </span>
                            </td>
                            <td
                              class={[
                                "px-2 py-2 text-right font-semibold",
                                signedAmount < 0
                                  ? "text-rose-300"
                                  : "text-emerald-300",
                              ].join(" ")}
                            >
                              {money.format(signedAmount)}
                            </td>
                            <td class="rounded-r-lg px-2 py-2">
                              {transaction.fromInstallment ? (
                                <p class="text-right text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                                  Ver en Créditos
                                </p>
                              ) : (
                                <div class="flex justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(transaction)}
                                    disabled={isSaving}
                                    class="rounded-md border border-violet-300/25 bg-black/35 p-1.5 text-violet-200 hover:border-violet-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Editar transacción"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      class="h-3.5 w-3.5"
                                    >
                                      <path d="M12 20h9" />
                                      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void removeTransaction(transaction)}
                                    disabled={isSaving}
                                    class="rounded-md border border-rose-300/30 bg-black/35 p-1.5 text-rose-200 hover:border-rose-300/55 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Eliminar transacción"
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      class="h-3.5 w-3.5"
                                    >
                                      <path d="M3 6h18" />
                                      <path d="M8 6V4h8v2" />
                                      <path d="M19 6l-1 14H6L5 6" />
                                      <path d="M10 11v6M14 11v6" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-violet-300/15 pt-3">
                <p class="text-xs text-violet-300/90">
                  Mostrando {startIndex}-{endIndex} de {filteredTransactions.length}
                </p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
                    disabled={page === 1}
                    class="rounded-md border border-violet-300/25 bg-black/25 px-2 py-1 text-xs text-violet-100 transition enabled:hover:border-violet-300/45 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Anterior
                  </button>
                  <span class="text-xs text-violet-200/90">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((previous) => Math.min(previous + 1, totalPages))
                    }
                    disabled={page === totalPages}
                    class="rounded-md border border-violet-300/25 bg-black/25 px-2 py-1 text-xs text-violet-100 transition enabled:hover:border-violet-300/45 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      {isModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#130c2b] p-5 shadow-2xl">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.08em] text-violet-300/85">
                  Finanzas
                </p>
                <h3 class="mt-1 text-xl font-semibold text-violet-100">
                  {editingId === null
                    ? "Nueva transacción"
                    : "Editar transacción"}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                class="rounded-md border border-violet-300/30 bg-black/25 px-2 py-1 text-xs text-violet-200"
              >
                Cerrar
              </button>
            </div>

            <form class="mt-4 grid gap-3" onSubmit={(event) => void saveTransaction(event)}>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Monto
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.amount}
                    onInput={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        amount: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Tipo
                  <select
                    value={form.type}
                    onChange={(event) => {
                      const nextType = event.currentTarget
                        .value as BackendTransactionType;

                      setForm((previous) => {
                        const matchesType = categories.some(
                          (category) =>
                            String(category.id) === previous.categoryId &&
                            category.normalizedType === nextType,
                        );

                        const defaultCategory =
                          nextType === "income"
                            ? categoriesByType.income[0]
                            : categoriesByType.expense[0];

                        return {
                          ...previous,
                          type: nextType,
                          categoryId: matchesType
                            ? previous.categoryId
                            : defaultCategory
                              ? String(defaultCategory.id)
                              : "",
                        };
                      });
                    }}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  >
                    <option value="income">Ingreso</option>
                    <option value="expense">Gasto</option>
                  </select>
                </label>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Categoría
                  <select
                    value={form.categoryId}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        categoryId: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  >
                    <option value="">Sin categoría</option>
                    {formCategoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Fecha
                  <input
                    type="date"
                    required
                    value={form.date}
                    onInput={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        date: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>
              </div>

              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Descripción
                <input
                  type="text"
                  required
                  value={form.description}
                  onInput={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      description: event.currentTarget.value,
                    }))
                  }
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                />
              </label>

              <div class="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  class="rounded-md border border-violet-300/25 bg-black/25 px-3 py-2 text-sm text-violet-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  class="rounded-md border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
