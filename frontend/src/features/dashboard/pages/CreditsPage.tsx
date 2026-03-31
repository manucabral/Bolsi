import { useEffect, useMemo, useState } from "preact/hooks";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../../../platform/auth/AuthProvider";
import {
  createCredit,
  deleteCredit,
  listCredits,
  updateCredit,
} from "../../../platform/pywebview/credits.api";
import {
  CreditScheduleChart,
  type CreditSchedulePoint,
} from "../components/CreditScheduleChart";
import { CreditProgressChart } from "../components/CreditProgressChart";
import type { CreditItem } from "../../../platform/pywebview/credits.api.types";
import { listCategories } from "../../../platform/pywebview/categories.api";
import type { CategoryItem } from "../../../platform/pywebview/categories.api.types";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type NormalizedCategoryType = "income" | "expense" | null;

type UiCategory = CategoryItem & {
  normalizedType: NormalizedCategoryType;
};

type UiCredit = {
  id: number;
  description: string;
  totalAmount: number;
  totalInstallments: number;
  installmentAmount: number;
  firstInstallmentDate: string;
  categoryId: number | null;
  categoryName: string;
  paidInstallments: number;
};

type CreditForm = {
  description: string;
  totalAmount: string;
  totalInstallments: string;
  installmentAmount: string;
  paidInstallments: string;
  firstInstallmentDate: string;
  categoryId: string;
};

type InstallmentDetail = {
  number: number;
  date: string;
  amount: number;
  status: "pagada" | "pendiente";
  isNext: boolean;
  isOverdue: boolean;
};

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addMonths(value: string, months: number) {
  const date = parseDate(value);
  date.setMonth(date.getMonth() + months);
  return date;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(parseDate(value));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDate(value));
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(parseDate(value))
    .replace(" de ", " ")
    .replace(" de ", " ");
}

function createEmptyForm(defaultCategoryId: number | null): CreditForm {
  return {
    description: "",
    totalAmount: "",
    totalInstallments: "",
    installmentAmount: "",
    paidInstallments: "0",
    firstInstallmentDate: toISODate(new Date()),
    categoryId: defaultCategoryId ? String(defaultCategoryId) : "",
  };
}

function mapCreditItem(item: CreditItem): UiCredit {
  return {
    id: item.id,
    description: item.description,
    totalAmount: item.total_amount,
    totalInstallments: item.installments,
    installmentAmount: item.installment_amount,
    firstInstallmentDate: item.start_date,
    categoryId: item.category_id ?? null,
    categoryName: item.category_name?.trim() || "Sin categoria",
    paidInstallments: Math.min(item.paid_installments, item.installments),
  };
}

function getNextInstallment(credit: UiCredit) {
  if (credit.paidInstallments >= credit.totalInstallments) {
    return null;
  }

  const nextInstallmentDate = addMonths(
    credit.firstInstallmentDate,
    credit.paidInstallments,
  );

  return {
    number: credit.paidInstallments + 1,
    date: toISODate(nextInstallmentDate),
    amount: credit.installmentAmount,
  };
}

function buildInstallments(credit: UiCredit): InstallmentDetail[] {
  const todayIso = toISODate(new Date());

  return Array.from({ length: credit.totalInstallments }, (_, index) => {
    const installmentNumber = index + 1;
    const installmentDate = toISODate(
      addMonths(credit.firstInstallmentDate, index),
    );
    const status =
      installmentNumber <= credit.paidInstallments ? "pagada" : "pendiente";
    const isOverdue = status === "pendiente" && installmentDate < todayIso;

    return {
      number: installmentNumber,
      date: installmentDate,
      amount: credit.installmentAmount,
      status,
      isNext:
        status === "pendiente" &&
        installmentNumber === credit.paidInstallments + 1,
      isOverdue,
    };
  });
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

function calculateInstallmentAmount(totalAmount: string, installments: string) {
  const total = Number(totalAmount);
  const count = Number(installments);

  if (
    !Number.isFinite(total) ||
    !Number.isFinite(count) ||
    total <= 0 ||
    count <= 0
  ) {
    return "";
  }

  return String(Math.round(total / count));
}

function calculateTotalAmount(installmentAmount: string, installments: string) {
  const amount = Number(installmentAmount);
  const count = Number(installments);

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(count) ||
    amount <= 0 ||
    count <= 0
  ) {
    return "";
  }

  return String(Math.round(amount * count));
}

export function CreditsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const [credits, setCredits] = useState<UiCredit[]>([]);
  const [categories, setCategories] = useState<UiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCreditId, setEditingCreditId] = useState<number | null>(null);
  const [selectedCreditId, setSelectedCreditId] = useState<number | null>(null);
  const [isFinishedExpanded, setIsFinishedExpanded] = useState(false);
  const [installmentEditedManually, setInstallmentEditedManually] =
    useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useKindNoticeToast(notice, setNotice);

  const expenseCategories = useMemo(
    () =>
      categories.filter((category) => category.normalizedType === "expense"),
    [categories],
  );

  const [form, setForm] = useState<CreditForm>(() => createEmptyForm(null));

  const creditCardClass =
    "group cursor-pointer rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)] transition hover:border-violet-300/40";

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const activeCredits = useMemo(
    () =>
      credits.filter(
        (credit) => credit.paidInstallments < credit.totalInstallments,
      ),
    [credits],
  );

  const finishedCredits = useMemo(
    () =>
      credits.filter(
        (credit) => credit.paidInstallments >= credit.totalInstallments,
      ),
    [credits],
  );

  useEffect(() => {
    if (activeCredits.length === 0) {
      setSelectedCreditId(null);
      return;
    }

    const exists = activeCredits.some(
      (credit) => credit.id === selectedCreditId,
    );
    if (!exists) {
      setSelectedCreditId(activeCredits[0].id);
    }
  }, [activeCredits, selectedCreditId]);

  const selectedCredit = useMemo(
    () =>
      activeCredits.find((credit) => credit.id === selectedCreditId) ?? null,
    [activeCredits, selectedCreditId],
  );

  const selectedInstallments = useMemo(
    () => (selectedCredit ? buildInstallments(selectedCredit) : []),
    [selectedCredit],
  );

  const useCompactActiveCreditsList = activeCredits.length > 2;

  const totalToPayThisMonth = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return activeCredits.reduce((sum, credit) => {
      const nextInstallment = getNextInstallment(credit);
      if (!nextInstallment) return sum;

      const nextDate = parseDate(nextInstallment.date);
      const sameMonth = nextDate.getMonth() === month;
      const sameYear = nextDate.getFullYear() === year;

      return sameMonth && sameYear ? sum + nextInstallment.amount : sum;
    }, 0);
  }, [activeCredits]);

  const totalPendingInstallments = useMemo(
    () =>
      activeCredits.reduce(
        (sum, credit) =>
          sum + (credit.totalInstallments - credit.paidInstallments),
        0,
      ),
    [activeCredits],
  );

  const totalRemainingBalance = useMemo(
    () =>
      activeCredits.reduce(
        (sum, credit) =>
          sum +
          (credit.totalInstallments - credit.paidInstallments) *
            credit.installmentAmount,
        0,
      ),
    [activeCredits],
  );

  const creditProgress = useMemo(() => {
    const paidInstallments = credits.reduce(
      (sum, credit) => sum + Math.min(credit.paidInstallments, credit.totalInstallments),
      0,
    );

    const pendingInstallments = credits.reduce(
      (sum, credit) =>
        sum + Math.max(credit.totalInstallments - credit.paidInstallments, 0),
      0,
    );

    const paidAmount = credits.reduce(
      (sum, credit) => sum + credit.paidInstallments * credit.installmentAmount,
      0,
    );

    const pendingAmount = credits.reduce(
      (sum, credit) =>
        sum +
        Math.max(credit.totalInstallments - credit.paidInstallments, 0) *
          credit.installmentAmount,
      0,
    );

    return {
      paidInstallments,
      pendingInstallments,
      paidAmount,
      pendingAmount,
    };
  }, [credits]);

  const upcomingInstallmentsSeries = useMemo((): CreditSchedulePoint[] => {
    const monthsToShow = 8;
    const currentMonth = new Date();
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const buckets = new Map<string, { amount: number; installments: number }>();

    for (let index = 0; index < monthsToShow; index += 1) {
      const bucketDate = new Date(start);
      bucketDate.setMonth(start.getMonth() + index);
      buckets.set(toMonthKey(bucketDate), { amount: 0, installments: 0 });
    }

    for (const credit of activeCredits) {
      for (
        let installmentIndex = credit.paidInstallments;
        installmentIndex < credit.totalInstallments;
        installmentIndex += 1
      ) {
        const installmentDate = addMonths(
          credit.firstInstallmentDate,
          installmentIndex,
        );
        const monthKey = toMonthKey(installmentDate);
        const currentBucket = buckets.get(monthKey);

        if (!currentBucket) continue;

        currentBucket.amount += credit.installmentAmount;
        currentBucket.installments += 1;
      }
    }

    return Array.from(buckets.entries()).map(([monthKey, values]) => ({
      time: `${monthKey}-01`,
      amount: values.amount,
      installments: values.installments,
    }));
  }, [activeCredits]);

  const parsedTotalAmount = Number(form.totalAmount);
  const parsedInstallments = Number(form.totalInstallments);
  const parsedInstallmentAmount = Number(form.installmentAmount);

  const calculatedTotal = parsedInstallments * parsedInstallmentAmount;
  const amountDifference = Math.abs(parsedTotalAmount - calculatedTotal);
  const tolerance = Math.max(5000, parsedTotalAmount * 0.2);
  const hasMismatch =
    Number.isFinite(parsedTotalAmount) &&
    Number.isFinite(parsedInstallments) &&
    Number.isFinite(parsedInstallmentAmount) &&
    parsedTotalAmount > 0 &&
    parsedInstallments > 0 &&
    parsedInstallmentAmount > 0 &&
    amountDifference > tolerance;

  const previewText = useMemo(() => {
    if (
      !Number.isFinite(parsedInstallments) ||
      parsedInstallments <= 0 ||
      !Number.isFinite(parsedInstallmentAmount) ||
      parsedInstallmentAmount <= 0 ||
      !form.firstInstallmentDate
    ) {
      return null;
    }

    const firstDate = form.firstInstallmentDate;
    const lastDate = toISODate(addMonths(firstDate, parsedInstallments - 1));

    return `Se generaran ${parsedInstallments} cuotas de ${money.format(parsedInstallmentAmount)} desde ${formatLongDate(firstDate)} hasta ${formatLongDate(lastDate)}.`;
  }, [
    form.firstInstallmentDate,
    parsedInstallments,
    parsedInstallmentAmount,
    money,
  ]);

  async function reloadCredits(currentUserId: number) {
    const response = await listCredits(currentUserId);
    if (!response.ok) {
      setCredits([]);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    const rows = response.data?.credits ?? [];
    setCredits(rows.map(mapCreditItem));
  }

  useEffect(() => {
    if (!userId) {
      setCredits([]);
      setCategories([]);
      setForm(createEmptyForm(null));
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [categoriesResponse, creditsResponse] = await Promise.all([
          listCategories(userId),
          listCredits(userId),
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

          const firstExpenseCategory =
            rows.find((category) => category.normalizedType === "expense") ??
            null;
          setForm((previous) =>
            previous.categoryId
              ? previous
              : createEmptyForm(firstExpenseCategory?.id ?? null),
          );
        } else {
          setCategories([]);
          setNotice({
            kind: "error",
            message: categoriesResponse.error ?? categoriesResponse.message,
          });
        }

        if (creditsResponse.ok) {
          const rows = creditsResponse.data?.credits ?? [];
          setCredits(rows.map(mapCreditItem));
        } else {
          setCredits([]);
          setNotice({
            kind: "error",
            message: creditsResponse.error ?? creditsResponse.message,
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setCredits([]);
        setCategories([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(
            error,
            "No se pudieron cargar creditos y categorias.",
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

  function openCreateModal() {
    setEditingCreditId(null);
    setInstallmentEditedManually(false);
    setForm(createEmptyForm(expenseCategories[0]?.id ?? null));
    setIsModalOpen(true);
  }

  function openEditModal(credit: UiCredit) {
    setEditingCreditId(credit.id);
    setInstallmentEditedManually(true);
    setForm({
      description: credit.description,
      totalAmount: String(credit.totalAmount),
      totalInstallments: String(credit.totalInstallments),
      installmentAmount: String(credit.installmentAmount),
      paidInstallments: String(credit.paidInstallments),
      firstInstallmentDate: credit.firstInstallmentDate,
      categoryId: credit.categoryId ? String(credit.categoryId) : "",
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCreditId(null);
  }

  async function removeCredit(id: number) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setIsSaving(true);
    setNotice(null);
    try {
      const response = await deleteCredit(userId, id);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadCredits(userId);
      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo eliminar el credito."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCredit(event: SubmitEvent) {
    event.preventDefault();

    const totalAmount = Number(form.totalAmount);
    const totalInstallments = Math.floor(Number(form.totalInstallments));
    const installmentAmount = Number(form.installmentAmount);
    const paidInstallments = Math.floor(Number(form.paidInstallments));

    const hasValidValues =
      Number.isFinite(totalAmount) &&
      Number.isFinite(totalInstallments) &&
      Number.isFinite(installmentAmount) &&
      totalAmount > 0 &&
      totalInstallments > 0 &&
      installmentAmount > 0;

    const hasValidPaidInstallments =
      Number.isFinite(paidInstallments) &&
      paidInstallments >= 0 &&
      paidInstallments <= totalInstallments;

    if (
      !hasValidValues ||
      !form.description.trim() ||
      !form.firstInstallmentDate
    ) {
      return;
    }

    if (!hasValidPaidInstallments) {
      setNotice({
        kind: "error",
        message:
          "Las cuotas pagadas deben estar entre 0 y la cantidad total de cuotas.",
      });
      return;
    }

    if (hasMismatch) {
      setNotice({
        kind: "error",
        message: "La relacion entre total y cuotas parece inconsistente.",
      });
      return;
    }

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const normalizedDescription = form.description.trim();
    const categoryId = form.categoryId ? Number(form.categoryId) : undefined;

    setIsSaving(true);
    setNotice(null);

    try {
      if (editingCreditId !== null) {
        const response = await updateCredit(
          userId,
          editingCreditId,
          normalizedDescription,
          totalAmount,
          totalInstallments,
          installmentAmount,
          form.firstInstallmentDate,
          categoryId,
          paidInstallments,
        );

        if (!response.ok) {
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        await reloadCredits(userId);
        const generated = response.data?.generated_installments;
        setNotice({
          kind: "success",
          message:
            typeof generated === "number"
              ? `${response.message}. Cuotas regeneradas: ${generated}.`
              : response.message,
        });
        closeModal();
        return;
      }

      const response = await createCredit(
        userId,
        normalizedDescription,
        totalAmount,
        totalInstallments,
        installmentAmount,
        form.firstInstallmentDate,
        categoryId,
        paidInstallments,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadCredits(userId);
      const generated = response.data?.generated_installments;
      setNotice({
        kind: "success",
        message:
          typeof generated === "number"
            ? `${response.message}. Cuotas generadas: ${generated}.`
            : response.message,
      });
      closeModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo guardar el credito."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardLayout
      title="Creditos"
      subtitle="Gestiona tus creditos y cuotas."
    >
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/25 bg-black/30 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!userId || isLoading}
            class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Nuevo credito
          </button>
        </div>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 px-4 py-3 text-right shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <p class="text-xs uppercase tracking-[0.08em] text-violet-300/90">
            Total a pagar este mes
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {money.format(totalToPayThisMonth)}
          </p>
        </article>
      </section>

      <section class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Creditos activos
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {activeCredits.length}
          </p>
        </article>

        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Cuotas pendientes
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {totalPendingInstallments}
          </p>
        </article>

        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3 sm:col-span-2 xl:col-span-1">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Saldo pendiente estimado
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {money.format(totalRemainingBalance)}
          </p>
        </article>
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <article class="rounded-2xl border border-violet-300/25 bg-black/30 p-4">
          <header>
            <h3 class="text-base font-semibold text-violet-100">Proyeccion de cuotas</h3>
            <p class="text-xs text-violet-300/85">
              Vista de los proximos meses con monto total y cantidad de cuotas pendientes.
            </p>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg border border-violet-300/20 bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/75">
              Cargando proyeccion...
            </p>
          ) : activeCredits.length === 0 ? (
            <p class="mt-3 rounded-lg border border-violet-300/20 bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/75">
              No hay creditos activos para proyectar cuotas.
            </p>
          ) : (
            <div class="mt-3">
              <CreditScheduleChart data={upcomingInstallmentsSeries} />
            </div>
          )}
        </article>

        {isLoading ? (
          <article class="rounded-2xl border border-violet-300/25 bg-black/30 p-4">
            <p class="rounded-lg border border-violet-300/20 bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/75">
              Cargando progreso...
            </p>
          </article>
        ) : (
          <CreditProgressChart
            paidAmount={creditProgress.paidAmount}
            pendingAmount={creditProgress.pendingAmount}
            paidInstallments={creditProgress.paidInstallments}
            pendingInstallments={creditProgress.pendingInstallments}
            formatAmount={(value) => money.format(value)}
          />
        )}
      </section>

      {isLoading ? (
        <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
          Cargando creditos...
        </p>
      ) : null}

      <section class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <article class="rounded-2xl border border-violet-300/25 bg-black/30 p-4">
          <header class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-violet-100">
                Creditos activos
              </h3>
              <p class="text-xs text-violet-300/85">
                Selecciona uno para revisar su cronograma.
              </p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {activeCredits.length}
            </span>
          </header>

          {!isLoading && activeCredits.length === 0 ? (
            <p class="mt-4 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
              Sin creditos activos.
            </p>
          ) : (
            <div
              class={[
                "mt-3",
                useCompactActiveCreditsList
                  ? "grid max-h-[30rem] gap-2 overflow-auto pr-1"
                  : "grid gap-3 sm:grid-cols-2",
              ].join(" ")}
            >
              {activeCredits.map((credit) => {
                const remainingInstallments =
                  credit.totalInstallments - credit.paidInstallments;
                const nextInstallment = getNextInstallment(credit);
                const progress =
                  credit.totalInstallments > 0
                    ? (credit.paidInstallments / credit.totalInstallments) * 100
                    : 0;

                return (
                  <article
                    key={credit.id}
                    class={[
                      creditCardClass,
                      selectedCreditId === credit.id
                        ? "ring-1 ring-violet-300/40"
                        : "",
                    ].join(" ")}
                    onClick={() => setSelectedCreditId(credit.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedCreditId(credit.id);
                      }
                    }}
                    tabIndex={0}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class="text-base font-semibold text-violet-100">
                          {credit.description}
                        </p>
                        <p class="text-xs text-violet-300/85">{credit.categoryName}</p>
                      </div>

                      <div class="flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(credit);
                          }}
                          disabled={isSaving}
                          class="rounded-md border border-violet-300/25 bg-black/35 p-1.5 text-violet-200 hover:border-violet-300/45"
                          title="Editar credito"
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
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeCredit(credit.id);
                          }}
                          disabled={isSaving}
                          class="rounded-md border border-red-300/30 bg-black/35 p-1.5 text-red-200 hover:border-red-300/55"
                          title="Eliminar credito"
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
                    </div>

                    <div class="mt-3 grid grid-cols-2 gap-2">
                      <div class="rounded-lg border border-violet-300/15 bg-violet-950/20 px-2.5 py-2">
                        <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                          Total
                        </p>
                        <p class="mt-1 text-sm font-semibold text-violet-100">
                          {money.format(credit.totalAmount)}
                        </p>
                      </div>
                      <div class="rounded-lg border border-violet-300/15 bg-violet-950/20 px-2.5 py-2">
                        <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                          Cuota
                        </p>
                        <p class="mt-1 text-sm font-semibold text-violet-100">
                          {money.format(credit.installmentAmount)}
                        </p>
                      </div>
                    </div>

                    <p class="mt-3 flex items-center justify-between text-xs text-violet-300/90">
                      <span>
                        {credit.paidInstallments}/{credit.totalInstallments} pagadas
                      </span>
                      <span>{remainingInstallments} restantes</span>
                    </p>

                    <p class="mt-1 flex items-center justify-between text-xs text-violet-300/90">
                      <span>Proximo vencimiento</span>
                      <span class="font-semibold text-violet-100">
                        {nextInstallment
                          ? formatShortDate(nextInstallment.date)
                          : "Sin cuotas pendientes"}
                      </span>
                    </p>

                    <div class="mt-2 h-2 rounded-full bg-violet-900/35">
                      <div
                        class="h-full rounded-full bg-linear-to-r from-violet-400 to-red-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </article>

        <div class="space-y-4">
          <section class="rounded-2xl border border-violet-300/25 bg-black/30 p-4">
            <header>
              <h3 class="text-base font-semibold text-violet-100">
                Detalle de cuotas
              </h3>
              <p class="text-xs text-violet-300/85">
                Cronograma completo del credito seleccionado.
              </p>
            </header>

            {selectedCredit ? (
              <>
                <div class="mt-3 grid grid-cols-2 gap-2">
                  <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
                    <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                      Credito
                    </p>
                    <p class="mt-1 text-sm font-semibold text-violet-100">
                      {selectedCredit.description}
                    </p>
                  </div>
                  <div class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
                    <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                      Plan
                    </p>
                    <p class="mt-1 text-sm font-semibold text-violet-100">
                      {selectedCredit.totalInstallments} cuotas
                    </p>
                  </div>
                </div>

                <div class="mt-3 max-h-96 overflow-auto rounded-lg border border-violet-300/20 bg-violet-950/20 p-2">
                  <div class="space-y-2">
                    {selectedInstallments.map((installment) => (
                      <div
                        key={`${selectedCredit.id}-${installment.number}`}
                        class={[
                          "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border bg-black/20 px-3 py-2",
                          installment.isOverdue
                            ? "border-red-300/30"
                            : "border-violet-300/15",
                        ].join(" ")}
                      >
                        <span
                          class={[
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
                            installment.status === "pagada"
                              ? "bg-teal-500/20 text-teal-200"
                              : installment.isOverdue
                                ? "bg-red-500/20 text-red-200"
                                : "bg-sky-500/20 text-sky-200",
                          ].join(" ")}
                        >
                          {installment.status === "pagada"
                            ? "pagada"
                            : installment.isOverdue
                              ? "vencido"
                              : "pendiente"}
                        </span>

                        <p class="text-sm text-violet-100">
                          Cuota {installment.number} - {formatCompactDate(installment.date)}
                          {installment.isNext ? (
                            <span class="ml-2 rounded-full border border-cyan-300/45 bg-cyan-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-cyan-100">
                              Siguiente
                            </span>
                          ) : null}
                        </p>

                        <p class="text-sm font-semibold text-violet-100">
                          {money.format(installment.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
                Selecciona un credito para ver el cronograma de cuotas.
              </p>
            )}
          </section>

          <section class="rounded-2xl border border-violet-300/20 bg-violet-950/20 p-4">
            <button
              type="button"
              onClick={() => setIsFinishedExpanded((previous) => !previous)}
              class="flex w-full items-center justify-between rounded-lg border border-violet-300/25 bg-black/25 px-3 py-2 text-left text-sm font-semibold text-violet-100"
            >
              <span>Finalizados ({finishedCredits.length})</span>
              <span>{isFinishedExpanded ? "Ocultar" : "Mostrar"}</span>
            </button>

            {isFinishedExpanded ? (
              <div class="mt-3 grid gap-2">
                {finishedCredits.length === 0 ? (
                  <p class="text-sm text-violet-300/85">Sin creditos finalizados.</p>
                ) : (
                  finishedCredits.map((credit) => (
                    <article
                      key={credit.id}
                      class="rounded-lg border border-violet-300/20 bg-black/25 p-3"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <p class="text-sm font-semibold text-violet-100">
                            {credit.description}
                          </p>
                          <p class="mt-1 text-xs text-violet-300/85">
                            {credit.categoryName}
                          </p>
                        </div>
                        <span class="rounded-full bg-teal-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-teal-200">
                          Completado
                        </span>
                      </div>
                      <p class="mt-2 text-xs text-violet-300/90">
                        Total: {money.format(credit.totalAmount)}
                      </p>
                    </article>
                  ))
                )}
              </div>
            ) : null}
          </section>
        </div>
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
                  {editingCreditId === null
                    ? "Nuevo credito"
                    : "Editar credito"}
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

            <form class="mt-4 grid gap-3" onSubmit={(event) => void saveCredit(event)}>
              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Descripcion
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

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Monto total
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.totalAmount}
                    onInput={(event) => {
                      const nextTotalAmount = event.currentTarget.value;
                      setForm((previous) => ({
                        ...previous,
                        totalAmount: nextTotalAmount,
                        installmentAmount:
                          !installmentEditedManually ||
                          previous.installmentAmount.trim() === ""
                            ? calculateInstallmentAmount(
                                nextTotalAmount,
                                previous.totalInstallments,
                              ) || previous.installmentAmount
                            : previous.installmentAmount,
                      }));
                    }}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Cantidad de cuotas
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.totalInstallments}
                    onInput={(event) => {
                      const nextInstallments = event.currentTarget.value;
                      setForm((previous) => ({
                        ...previous,
                        totalInstallments: nextInstallments,
                        paidInstallments:
                          Number.isFinite(Number(nextInstallments)) &&
                          Number(nextInstallments) > 0 &&
                          Number(previous.paidInstallments) >
                            Number(nextInstallments)
                            ? String(Math.floor(Number(nextInstallments)))
                            : previous.paidInstallments,
                        installmentAmount:
                          !installmentEditedManually ||
                          previous.installmentAmount.trim() === ""
                            ? calculateInstallmentAmount(
                                previous.totalAmount,
                                nextInstallments,
                              ) || previous.installmentAmount
                            : previous.installmentAmount,
                      }));
                    }}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Monto por cuota
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={form.installmentAmount}
                    onInput={(event) => {
                      const nextInstallmentAmount = event.currentTarget.value;
                      setInstallmentEditedManually(
                        nextInstallmentAmount.trim().length > 0,
                      );
                      setForm((previous) => {
                        const nextTotalAmount =
                          previous.totalAmount.trim() === ""
                            ? calculateTotalAmount(
                                nextInstallmentAmount,
                                previous.totalInstallments,
                              )
                            : previous.totalAmount;

                        return {
                          ...previous,
                          installmentAmount: nextInstallmentAmount,
                          totalAmount: nextTotalAmount,
                        };
                      });
                    }}
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Cuotas pagadas
                  <input
                    type="number"
                    min="0"
                    max={form.totalInstallments || undefined}
                    step="1"
                    required
                    value={form.paidInstallments}
                    onInput={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        paidInstallments: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Fecha primera cuota
                  <input
                    type="date"
                    required
                    value={form.firstInstallmentDate}
                    onInput={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        firstInstallmentDate: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  />
                </label>
              </div>

              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Categoria
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
                  <option value="">Sin categoria</option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                      disabled={category.normalizedType !== "expense"}
                    >
                      {category.name}
                      {category.normalizedType !== "expense"
                        ? " (solo ingreso)"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {categories.length > 0 && expenseCategories.length === 0 ? (
                <p class="rounded-lg border border-sky-300/30 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
                  Tienes categorias cargadas, pero ninguna de tipo gasto. Crea
                  una categoria de gasto para asignarla al credito.
                </p>
              ) : null}

              {previewText ? (
                <p class="rounded-lg border border-violet-300/20 bg-violet-950/25 px-3 py-2 text-sm text-violet-200">
                  {previewText}
                </p>
              ) : null}

              {hasMismatch ? (
                <p class="rounded-lg border border-sky-300/30 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
                  La relacion entre total y cuotas parece inconsistente. Revisa
                  los montos antes de guardar.
                </p>
              ) : null}

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


