import { useEffect, useMemo, useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import { listCategories } from "../../../platform/pywebview/categories.api";
import type { CategoryItem } from "../../../platform/pywebview/categories.api.types";
import {
  createBill,
  deleteBill,
  listMonthBills,
  markBillPaid,
  markBillUnpaid,
  updateBill,
} from "../../../platform/pywebview/bills.api";
import type {
  BillItem,
  BillStatus,
} from "../../../platform/pywebview/bills.api.types";
import { DashboardLayout } from "../components/DashboardLayout";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type NormalizedCategoryType = "income" | "expense" | null;

type UiCategory = CategoryItem & {
  normalizedType: NormalizedCategoryType;
};

type BillForm = {
  name: string;
  amount: string;
  dueDate: string;
  categoryId: string;
  notes: string;
};

type BillStatusFilter = "all" | BillStatus;

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

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return `${day} ${month} ${year}`.trim();
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

function statusLabel(status: BillStatus) {
  if (status === "pending") return "Pendiente";
  if (status === "paid") return "Pagada";
  return "Vencida";
}

function statusBadgeClass(status: BillStatus) {
  if (status === "paid") {
    return "border-teal-300/45 bg-teal-400/15 text-teal-100";
  }
  if (status === "overdue") {
    return "border-red-300/45 bg-red-400/20 text-red-100";
  }
  return "border-sky-300/45 bg-sky-300/15 text-sky-100";
}

function getPaidAmount(bill: BillItem) {
  const value = Number(bill.paid_amount ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, Number(bill.amount));
}

function getRemainingAmount(bill: BillItem) {
  const fromApi = Number(bill.remaining_amount);
  if (Number.isFinite(fromApi) && fromApi >= 0) {
    return fromApi;
  }

  return Math.max(Number(bill.amount) - getPaidAmount(bill), 0);
}

function dueHintText(bill: BillItem) {
  if (bill.status === "paid") {
    return "Pagada";
  }

  const paidAmount = getPaidAmount(bill);
  const remainingAmount = getRemainingAmount(bill);
  if (paidAmount > 0 && remainingAmount > 0) {
    return "Pago parcial registrado";
  }

  const days = bill.days_until_due;
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

function billUrgencyLevel(bill: BillItem): "critical" | "warning" | "paid" | "normal" {
  if (bill.status === "paid") {
    return "paid";
  }

  if (bill.status === "overdue") {
    return "critical";
  }

  const days = bill.days_until_due;
  if (typeof days === "number" && days >= 0) {
    if (days <= 1) return "critical";
    if (days < 7) return "warning";
  }

  return "normal";
}

function billCardClassByUrgency(level: "critical" | "warning" | "paid" | "normal") {
  if (level === "paid") {
    return "border-teal-300/45 bg-teal-500/10";
  }

  if (level === "critical") {
    return "border-red-300/45 bg-red-500/10";
  }

  if (level === "warning") {
    return "border-yellow-300/45 bg-yellow-500/10";
  }

  return "border-violet-300/20 bg-black/30";
}

function getDueDateForActivePeriod(year: string, month: string) {
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) {
    return toISODate(new Date());
  }

  const today = new Date();
  const lastDayOfMonth = new Date(parsedYear, parsedMonth, 0).getDate();
  const day = String(Math.min(today.getDate(), lastDayOfMonth)).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createEmptyForm(
  defaultCategoryId?: number | null,
  defaultDueDate?: string,
): BillForm {
  return {
    name: "",
    amount: "",
    dueDate: defaultDueDate ?? toISODate(new Date()),
    categoryId:
      defaultCategoryId !== null && defaultCategoryId !== undefined
        ? String(defaultCategoryId)
        : "",
    notes: "",
  };
}

export function BillsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const now = new Date();
  const defaultYear = String(now.getFullYear());
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");

  const [bills, setBills] = useState<BillItem[]>([]);
  const [categories, setCategories] = useState<UiCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useKindNoticeToast(notice, setNotice);

  const [yearFilter, setYearFilter] = useState(defaultYear);
  const [monthFilter, setMonthFilter] = useState(defaultMonth);
  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>("all");
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBillId, setEditingBillId] = useState<number | null>(null);
  const [form, setForm] = useState<BillForm>(createEmptyForm());

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.normalizedType === "expense"),
    [categories],
  );

  const selectedMonthLabel = useMemo(
    () => MONTHS.find((month) => month.value === monthFilter)?.label ?? monthFilter,
    [monthFilter],
  );

  const availableYears = useMemo(() => {
    const current = Number(defaultYear);
    const yearSet = new Set<number>([current - 2, current - 1, current, current + 1]);

    for (const bill of bills) {
      const year = Number(bill.due_date.slice(0, 4));
      if (Number.isFinite(year)) {
        yearSet.add(year);
      }
    }

    return Array.from(yearSet).sort((a, b) => b - a).map((year) => String(year));
  }, [bills, defaultYear]);

  const pendingBills = useMemo(
    () => bills.filter((bill) => bill.status === "pending"),
    [bills],
  );
  const overdueBills = useMemo(
    () => bills.filter((bill) => bill.status === "overdue"),
    [bills],
  );
  const paidBills = useMemo(
    () => bills.filter((bill) => bill.status === "paid"),
    [bills],
  );

  const dueSoonCount = useMemo(
    () =>
      pendingBills.filter(
        (bill) =>
          typeof bill.days_until_due === "number" &&
          bill.days_until_due >= 0 &&
          bill.days_until_due <= 3,
      ).length,
    [pendingBills],
  );

  const openBills = useMemo(
    () => bills.filter((bill) => bill.status === "pending" || bill.status === "overdue"),
    [bills],
  );

  const editingBill = useMemo(
    () => bills.find((bill) => bill.id === editingBillId) ?? null,
    [bills, editingBillId],
  );

  const openRemainingTotal = useMemo(
    () => openBills.reduce((sum, bill) => sum + getRemainingAmount(bill), 0),
    [openBills],
  );

  const visibleBills = useMemo(() => {
    const filtered =
      statusFilter === "all"
        ? bills
        : bills.filter((bill) => bill.status === statusFilter);

    return [...filtered].sort((a, b) => {
      const priorityMap = {
        critical: 0,
        warning: 1,
        normal: 2,
        paid: 3,
      } as const;

      const byPriority =
        priorityMap[billUrgencyLevel(a)] - priorityMap[billUrgencyLevel(b)];
      if (byPriority !== 0) return byPriority;

      const byDueDate = a.due_date.localeCompare(b.due_date);
      if (byDueDate !== 0) return byDueDate;

      return a.id - b.id;
    });
  }, [bills, statusFilter]);

  const visibleOpenBills = useMemo(
    () => visibleBills.filter((bill) => bill.status !== "paid"),
    [visibleBills],
  );

  const visiblePaidBills = useMemo(
    () => visibleBills.filter((bill) => bill.status === "paid"),
    [visibleBills],
  );

  const yearNumber = Number(yearFilter);
  const monthNumber = Number(monthFilter);

  async function reloadBills(currentUserId: number, silent = true) {
    const response = await listMonthBills(currentUserId, yearNumber, monthNumber);

    if (!response.ok) {
      setBills([]);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    setBills(response.data?.bills ?? []);

    if (!silent) {
      setNotice({ kind: "success", message: response.message });
    }
  }

  useEffect(() => {
    if (!userId) {
      setBills([]);
      setCategories([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [billsResponse, categoriesResponse] = await Promise.all([
          listMonthBills(userId, yearNumber, monthNumber),
          listCategories(userId),
        ]);

        if (!isMounted) return;

        if (!billsResponse.ok) {
          setBills([]);
          setNotice({
            kind: "error",
            message: billsResponse.error ?? billsResponse.message,
          });
        } else {
          setBills(billsResponse.data?.bills ?? []);
        }

        if (!categoriesResponse.ok) {
          setCategories([]);
          setNotice({
            kind: "error",
            message: categoriesResponse.error ?? categoriesResponse.message,
          });
        } else {
          const rows = categoriesResponse.data?.categories ?? [];
          const mapped = rows.map((category) => ({
            ...category,
            normalizedType: normalizeCategoryType(category.type),
          }));
          setCategories(mapped);
        }
      } catch (error) {
        if (!isMounted) return;

        setBills([]);
        setCategories([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(
            error,
            "No se pudieron cargar las facturas.",
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
  }, [userId, yearNumber, monthNumber]);

  function openCreateModal() {
    const defaultExpenseCategory = expenseCategories[0]?.id ?? null;
    const dueDateForFilter = getDueDateForActivePeriod(yearFilter, monthFilter);
    setEditingBillId(null);
    setForm(createEmptyForm(defaultExpenseCategory, dueDateForFilter));
    setIsModalOpen(true);
  }

  function openEditModal(bill: BillItem) {
    setEditingBillId(bill.id);
    setForm({
      name: bill.name,
      amount: String(bill.amount),
      dueDate: bill.due_date,
      categoryId:
        bill.category_id !== null && bill.category_id !== undefined
          ? String(bill.category_id)
          : "",
      notes: bill.notes ?? "",
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingBillId(null);
  }

  async function saveBill(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const normalizedName = form.name.trim();
    const normalizedNotes = form.notes.trim();
    const parsedAmount = Number(form.amount);

    if (!normalizedName) {
      setNotice({ kind: "error", message: "El nombre es obligatorio." });
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setNotice({ kind: "error", message: "El monto debe ser mayor a 0." });
      return;
    }

    if (!form.dueDate) {
      setNotice({ kind: "error", message: "La fecha de vencimiento es obligatoria." });
      return;
    }

    const parsedCategoryId = form.categoryId ? Number(form.categoryId) : undefined;
    const categoryId =
      parsedCategoryId !== undefined && Number.isFinite(parsedCategoryId)
        ? parsedCategoryId
        : undefined;

    setIsSaving(true);
    setNotice(null);

    try {
      if (editingBillId !== null) {
        const response = await updateBill(
          userId,
          editingBillId,
          normalizedName,
          parsedAmount,
          form.dueDate,
          categoryId,
          normalizedNotes,
        );

        if (!response.ok) {
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        await reloadBills(userId);
        setNotice({ kind: "success", message: response.message });

        closeModal();
        return;
      }

      const response = await createBill(
        userId,
        normalizedName,
        parsedAmount,
        form.dueDate,
        categoryId,
        normalizedNotes,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadBills(userId);
      setNotice({ kind: "success", message: response.message });

      closeModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo guardar la factura."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function markAsPaid(bill: BillItem) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    if (bill.status === "paid") {
      setNotice({ kind: "error", message: "La factura ya esta pagada." });
      return;
    }

    const remainingAmount = getRemainingAmount(bill);
    if (remainingAmount <= 0) {
      setNotice({ kind: "error", message: "La factura no tiene saldo pendiente." });
      return;
    }

    const suggestedAmount =
      remainingAmount % 1 === 0
        ? String(Math.trunc(remainingAmount))
        : remainingAmount.toFixed(2);

    const paymentInput = window.prompt(
      `Ingrese el monto a pagar para \"${bill.name}\".\nSaldo pendiente: ${money.format(remainingAmount)}\n\nSe creara una transaccion de gasto por el monto ingresado.`,
      suggestedAmount,
    );
    if (paymentInput === null) return;

    const normalizedInput = paymentInput.trim().replace(",", ".");
    const parsedPaymentAmount = Number(normalizedInput);

    if (!Number.isFinite(parsedPaymentAmount) || parsedPaymentAmount <= 0) {
      setNotice({ kind: "error", message: "El monto del pago debe ser mayor a 0." });
      return;
    }

    if (parsedPaymentAmount > remainingAmount + 1e-6) {
      setNotice({
        kind: "error",
        message: `El pago no puede superar el saldo pendiente (${money.format(remainingAmount)}).`,
      });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await markBillPaid(
        userId,
        bill.id,
        undefined,
        parsedPaymentAmount,
      );
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadBills(userId);

      const transactionId = response.generated_transaction_id;
      const appliedAmount = Number(response.applied_amount ?? parsedPaymentAmount);
      const remainingAfter = Number(response.remaining_amount);
      const details =
        typeof transactionId === "number"
          ? ` Transaccion generada #${transactionId}.`
          : "";
      const paymentSummary = Number.isFinite(remainingAfter)
        ? ` Pago registrado: ${money.format(appliedAmount)}. Restante: ${money.format(remainingAfter)}.`
        : ` Pago registrado: ${money.format(appliedAmount)}.`;

      setNotice({
        kind: "success",
        message: `${response.message}.${paymentSummary}${details}`.replace("..", "."),
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo marcar la factura como pagada."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function markAsUnpaid(bill: BillItem) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const currentPaidAmount = getPaidAmount(bill);
    if (currentPaidAmount <= 0) {
      setNotice({ kind: "error", message: "La factura no tiene pagos para resetear." });
      return;
    }

    const ok = window.confirm(
      `Se va a resetear la factura \"${bill.name}\".\n\n` +
        `Se eliminaran las transacciones de pago asociadas y el saldo volvera a ${money.format(bill.amount)}.`,
    );
    if (!ok) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await markBillUnpaid(userId, bill.id);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadBills(userId);
      setNotice({
        kind: "success",
        message: `${response.message}. Se eliminaron las transacciones de pago y se restauro el saldo pendiente.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo marcar la factura como no pagada."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeBill(bill: BillItem) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const ok = window.confirm(`Eliminar la factura \"${bill.name}\"?`);
    if (!ok) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await deleteBill(userId, bill.id);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadBills(userId);
      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo eliminar la factura."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function renderBillCard(bill: BillItem) {
    const isDueSoon =
      bill.status === "pending" &&
      typeof bill.days_until_due === "number" &&
      bill.days_until_due >= 0 &&
      bill.days_until_due <= 3;
    const urgencyLevel = billUrgencyLevel(bill);
    const hasNote = Boolean(bill.notes?.trim());
    const isNoteExpanded = expandedNotes[bill.id] === true;
    const hasPayments = getPaidAmount(bill) > 0;

    return (
      <article
        key={bill.id}
        class={[
          "rounded-xl border p-4 shadow-[0_10px_26px_rgba(8,7,24,0.35)]",
          billCardClassByUrgency(urgencyLevel),
        ].join(" ")}
      >
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-base font-semibold text-violet-100">{bill.name}</p>
            <p class="mt-1 text-xs text-violet-200/75">
              Vence: {formatLongDate(bill.due_date)}
            </p>
            <p class="mt-1 text-xs text-violet-200/75">
              {dueHintText(bill)}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span
              class={[
                "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
                statusBadgeClass(bill.status),
              ].join(" ")}
            >
              {statusLabel(bill.status)}
            </span>
            {isDueSoon ? (
              <span class="inline-flex items-center rounded-md border border-red-300/45 bg-red-400/20 px-2 py-1 text-[11px] font-medium text-red-100">
                Alerta
              </span>
            ) : null}
          </div>
        </header>

        <div class="mt-3 grid grid-cols-1 gap-2 text-sm text-violet-100 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span class="text-violet-200/70">Monto total:</span>{" "}
            <strong>{money.format(bill.amount)}</strong>
          </p>
          <p>
            <span class="text-violet-200/70">Abonado:</span>{" "}
            <strong>{money.format(getPaidAmount(bill))}</strong>
          </p>
          <p>
            <span class="text-violet-200/70">Restante:</span>{" "}
            <strong>{money.format(getRemainingAmount(bill))}</strong>
          </p>
          <p>
            <span class="text-violet-200/70">Categoria:</span>{" "}
            {bill.category_name?.trim() || "Sin categoria"}
          </p>
        </div>

        {hasNote ? (
          <div class="mt-3">
            <button
              type="button"
              onClick={() =>
                setExpandedNotes((previous) => ({
                  ...previous,
                  [bill.id]: !previous[bill.id],
                }))
              }
              class="text-xs font-medium text-violet-200 underline-offset-2 transition hover:text-violet-100 hover:underline"
            >
              {isNoteExpanded ? "Ocultar nota" : "Ver nota"}
            </button>

            {isNoteExpanded ? (
              <p class="mt-2 rounded-md border border-violet-300/15 bg-violet-900/20 px-3 py-2 text-sm text-violet-100/90">
                {bill.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        <footer class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openEditModal(bill)}
            class="rounded-md border border-violet-300/25 bg-violet-900/25 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-800/35"
          >
            Editar
          </button>

          {bill.status !== "paid" ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void markAsPaid(bill)}
              class="rounded-md border border-teal-300/35 bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hasPayments ? "Agregar pago" : "Marcar pagada"}
            </button>
          ) : null}

          {hasPayments ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void markAsUnpaid(bill)}
              class="rounded-md border border-amber-300/35 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Restaurar pagos
            </button>
          ) : null}

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void removeBill(bill)}
            class="rounded-md border border-red-300/35 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar
          </button>
        </footer>
      </article>
    );
  }

  return (
    <DashboardLayout
      title="Facturas y vencimientos"
      subtitle="Pagos pendientes con alertas de vencimiento."
    >
      <div class="grid gap-4">
        <section class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <article class="rounded-xl border border-violet-300/20 bg-black/25 p-3">
            <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
              Saldo pendiente total
            </p>
            <p class="mt-2 text-xl font-semibold text-violet-100">
              {money.format(openRemainingTotal)}
            </p>
            <p class="mt-1 text-xs text-violet-200/70">
              Incluye facturas de otros meses
            </p>
          </article>

          <article class="rounded-xl border border-sky-300/35 bg-sky-300/10 p-3">
            <p class="text-[11px] uppercase tracking-[0.08em] text-sky-100/90">
              Pendientes
            </p>
            <p class="mt-2 text-xl font-semibold text-sky-100">{pendingBills.length}</p>
          </article>

          <article class="rounded-xl border border-red-300/35 bg-red-400/10 p-3">
            <p class="text-[11px] uppercase tracking-[0.08em] text-red-100/90">
              Vencidas
            </p>
            <p class="mt-2 text-xl font-semibold text-red-100">{overdueBills.length}</p>
          </article>

          <article class="rounded-xl border border-teal-300/35 bg-teal-400/10 p-3">
            <p class="text-[11px] uppercase tracking-[0.08em] text-teal-100/90">
              Pagadas
            </p>
            <p class="mt-2 text-xl font-semibold text-teal-100">{paidBills.length}</p>
          </article>

          <article class="rounded-xl border border-red-300/45 bg-red-500/15 p-3">
            <p class="text-[11px] uppercase tracking-[0.08em] text-red-100/95">
              Alerta proximas 72h
            </p>
            <p class="mt-2 text-xl font-semibold text-red-100">{dueSoonCount}</p>
          </article>
        </section>

        <section class="rounded-xl border border-violet-300/20 bg-black/25 p-3">
          <div class="flex flex-wrap items-end gap-3">
            <label class="grid gap-1 text-xs text-violet-200/80">
              Mes
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.currentTarget.value)}
                class="rounded-md border border-violet-300/25 bg-violet-950/35 px-2 py-1.5 text-sm text-violet-100"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label class="grid gap-1 text-xs text-violet-200/80">
              Anio
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.currentTarget.value)}
                class="rounded-md border border-violet-300/25 bg-violet-950/35 px-2 py-1.5 text-sm text-violet-100"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label class="grid gap-1 text-xs text-violet-200/80">
              Estado
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.currentTarget.value as BillStatusFilter)
                }
                class="rounded-md border border-violet-300/25 bg-violet-950/35 px-2 py-1.5 text-sm text-violet-100"
              >
                <option value="all">Todas</option>
                <option value="pending">Pendientes</option>
                <option value="paid">Pagadas (periodo)</option>
                <option value="overdue">Vencidas</option>
              </select>
            </label>

            <div class="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openCreateModal}
                class="rounded-md border border-violet-200/35 bg-violet-600/35 px-3 py-2 text-sm font-medium text-violet-50 transition hover:bg-violet-500/45"
              >
                Nueva factura
              </button>
            </div>
          </div>
          <p class="mt-3 text-xs text-violet-300/85">
            Mes y año filtran solo las facturas pagadas. Las pendientes y vencidas se muestran siempre.
          </p>
        </section>

        {isLoading ? (
          <section class="rounded-xl border border-violet-300/20 bg-black/25 p-5 text-sm text-violet-200/80">
            Cargando facturas...
          </section>
        ) : bills.length === 0 ? (
          <section class="rounded-xl border border-violet-300/20 bg-black/25 p-5 text-sm text-violet-200/80">
            No hay facturas pendientes/vencidas ni pagadas en {selectedMonthLabel} {yearFilter}.
          </section>
        ) : visibleBills.length === 0 ? (
          <section class="rounded-xl border border-violet-300/20 bg-black/25 p-5 text-sm text-violet-200/80">
            No hay facturas para el estado seleccionado en {selectedMonthLabel} {yearFilter}.
          </section>
        ) : (
          <section class="grid gap-3">
            {visibleOpenBills.length > 0 ? (
              <div class="grid gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/85">
                  Por pagar
                </p>
                {visibleOpenBills.map((bill) => renderBillCard(bill))}
              </div>
            ) : null}

            {visiblePaidBills.length > 0 ? (
              <div class="grid gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.08em] text-violet-300/85">
                  Pagadas en {selectedMonthLabel} {yearFilter}
                </p>
                {visiblePaidBills.map((bill) => renderBillCard(bill))}
              </div>
            ) : null}
          </section>
        )}
      </div>

      {isModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#17142d] p-5 shadow-[0_22px_50px_rgba(7,6,20,0.55)]">
            <h3 class="text-lg font-semibold text-violet-100">
              {editingBillId === null ? "Nueva factura" : "Editar factura"}
            </h3>
            {editingBill ? (
              <p class="mt-1 text-xs text-violet-300/85">
                Creada: {formatLongDate(editingBill.created_at.slice(0, 10))}
              </p>
            ) : null}

            <form class="mt-4 grid gap-3" onSubmit={saveBill}>
              <label class="grid gap-1 text-sm text-violet-100">
                Nombre
                <input
                  required
                  type="text"
                  value={form.name}
                  onInput={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      name: event.currentTarget.value,
                    }))
                  }
                  class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  placeholder="Resumen Visa, Internet, Expensas..."
                />
              </label>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-sm text-violet-100">
                  Monto
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.amount}
                    onInput={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        amount: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>

                <label class="grid gap-1 text-sm text-violet-100">
                  Vencimiento
                  <input
                    required
                    type="date"
                    value={form.dueDate}
                    onInput={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        dueDate: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>
              </div>

              <label class="grid gap-1 text-sm text-violet-100">
                Categoria (gasto)
                <select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      categoryId: event.currentTarget.value,
                    }))
                  }
                  class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                >
                  <option value="">Sin categoria</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label class="grid gap-1 text-sm text-violet-100">
                Notas
                <textarea
                  value={form.notes}
                  onInput={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      notes: event.currentTarget.value,
                    }))
                  }
                  rows={3}
                  class="resize-y rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  placeholder="Opcional"
                />
              </label>

              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeModal}
                  class="rounded-md border border-violet-300/25 bg-violet-900/25 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-800/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  class="rounded-md border border-violet-200/35 bg-violet-600/35 px-3 py-2 text-sm font-medium text-violet-50 transition hover:bg-violet-500/45 disabled:cursor-not-allowed disabled:opacity-60"
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


