import { useEffect, useMemo, useState } from "preact/hooks";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../../../platform/auth/AuthProvider";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../../../platform/pywebview/categories.api";
import type {
  CategoryItem,
  CategoryType,
} from "../../../platform/pywebview/categories.api.types";
import { listTransactions } from "../../../platform/pywebview/transactions.api";
import type { TransactionItem } from "../../../platform/pywebview/transactions.api.types";
import {
  loadCategoryColors,
  removeCategoryColor,
  saveCategoryColors,
} from "../data/categoryColors";
import { SectionExportActions } from "../components/SectionExportActions";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type UiCategory = CategoryItem & {
  color: string;
};

type CategoryForm = {
  name: string;
  type: CategoryType;
  color: string;
};

const FALLBACK_COLORS = [
  "#8b5cf6",
  "#d946ef",
  "#6366f1",
  "#ec4899",
  "#a855f7",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#f97316",
];

function createEmptyForm(): CategoryForm {
  return {
    name: "",
    type: "expense",
    color: "#8b5cf6",
  };
}

function parseYearMonthFromDate(value: string): { year: number; month: number } | null {
  const trimmed = value.trim();
  const yyyyMmDdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (yyyyMmDdMatch) {
    const year = Number(yyyyMmDdMatch[1]);
    const month = Number(yyyyMmDdMatch[2]);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
  };
}

function sortCategories(categories: UiCategory[]): UiCategory[] {
  return [...categories].sort((a, b) => {
    const byType = a.type.localeCompare(b.type);
    if (byType !== 0) return byType;
    return a.name.localeCompare(b.name);
  });
}

function fallbackColorForCategory(category: CategoryItem) {
  const index = (category.id + category.name.length) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
}

function toTypeLabel(type: CategoryType) {
  return type === "expense" ? "gasto" : "ingreso";
}

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

export function CategoriesPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const [categories, setCategories] = useState<UiCategory[]>([]);
  const [activeType, setActiveType] = useState<CategoryType>("expense");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [form, setForm] = useState<CategoryForm>(createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);

  useKindNoticeToast(notice, setNotice);

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setNotice(null);

      try {
        const [categoriesResponse, transactionsResponse] = await Promise.all([
          listCategories(userId),
          listTransactions(userId),
        ]);
        if (!isMounted) return;

        if (!categoriesResponse.ok) {
          setCategories([]);
          setTransactions([]);
          setNotice({
            kind: "error",
            message: categoriesResponse.error ?? categoriesResponse.message,
          });
          return;
        }

        const rows = categoriesResponse.data?.categories ?? [];
        const colors = loadCategoryColors();
        let colorsChanged = false;

        const mapped = rows.map((category) => {
          const key = String(category.id);
          const resolvedColor =
            category.color ?? colors[key] ?? fallbackColorForCategory(category);

          if (!colors[key]) {
            colors[key] = resolvedColor;
            colorsChanged = true;
          }

          return {
            ...category,
            color: resolvedColor,
          };
        });

        if (colorsChanged) {
          saveCategoryColors(colors);
        }

        setCategories(sortCategories(mapped));

        if (transactionsResponse.ok) {
          setTransactions(transactionsResponse.data?.transactions ?? []);
        } else {
          setTransactions([]);
          setNotice({
            kind: "error",
            message:
              transactionsResponse.error ??
              "No se pudo cargar la distribucion mensual real de categorias.",
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setCategories([]);
        setTransactions([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(
            error,
            "No se pudieron cargar las categorias.",
          ),
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const distributionRows = useMemo(() => {
    const current = new Date();
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;
    const totalsByCategory = new Map<number, number>();

    for (const transaction of transactions) {
      if (transaction.type !== activeType) continue;

      const yearMonth = parseYearMonthFromDate(transaction.date);
      if (!yearMonth) continue;
      if (yearMonth.year !== currentYear || yearMonth.month !== currentMonth) {
        continue;
      }

      const categoryId = transaction.category_id;
      if (!categoryId) continue;

      const currentAmount = totalsByCategory.get(categoryId) ?? 0;
      totalsByCategory.set(categoryId, currentAmount + Math.abs(transaction.amount));
    }

    const rows = categories
      .filter((category) => category.type === activeType)
      .map((category) => ({
        ...category,
        amount: totalsByCategory.get(category.id) ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const total = rows.reduce((sum, row) => sum + row.amount, 0);

    return rows.map((row) => {
      const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
      return {
        ...row,
        share,
      };
    });
  }, [categories, transactions, activeType]);

  const activeTypeCategories = useMemo(
    () =>
      categories
        .filter((category) => category.type === activeType)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, activeType],
  );

  const expenseCategoriesCount = useMemo(
    () => categories.filter((category) => category.type === "expense").length,
    [categories],
  );

  const incomeCategoriesCount = useMemo(
    () => categories.filter((category) => category.type === "income").length,
    [categories],
  );

  const activeTypeMonthlyTotal = useMemo(
    () => distributionRows.reduce((sum, category) => sum + category.amount, 0),
    [distributionRows],
  );

  const topCategory = distributionRows.length > 0 ? distributionRows[0] : null;

  function openCreateModal() {
    setEditingCategoryId(null);
    setForm(createEmptyForm());
    setIsModalOpen(true);
  }

  function openEditModal(category: UiCategory) {
    setEditingCategoryId(category.id);
    setForm({
      name: category.name,
      type: category.type,
      color: category.color,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCategoryId(null);
  }

  async function saveCategory(event: SubmitEvent) {
    event.preventDefault();

    const normalizedName = form.name.trim();
    if (!normalizedName) return;

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    if (editingCategoryId !== null) {
      try {
        const response = await updateCategory(
          userId,
          editingCategoryId,
          normalizedName,
          form.type,
          form.color,
        );

        if (!response.ok || !response.data?.category) {
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        const updated = response.data.category;
        const colors = {
          ...loadCategoryColors(),
          [String(updated.id)]: form.color,
        };
        saveCategoryColors(colors);

        setCategories((previous) =>
          sortCategories(
            previous.map((category) => {
              if (category.id !== updated.id) return category;

              return {
                ...updated,
                color: form.color,
              };
            }),
          ),
        );

        setNotice({
          kind: "success",
          message: response.message,
        });
        closeModal();
      } catch (error) {
        setNotice({
          kind: "error",
          message: toUiErrorMessage(
            error,
            "No se pudo actualizar la categoria.",
          ),
        });
      } finally {
        setIsSaving(false);
      }
      return;
    }

    try {
      const response = await createCategory(
        userId,
        normalizedName,
        form.type,
        form.color,
      );

      if (!response.ok || !response.data?.category) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const created = response.data.category;
      const colors = {
        ...loadCategoryColors(),
        [String(created.id)]: form.color,
      };
      saveCategoryColors(colors);

      setCategories((previous) =>
        sortCategories([...previous, { ...created, color: form.color }]),
      );

      setNotice({ kind: "success", message: response.message });
      closeModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(
          error,
          "No se pudo crear la categoria.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onDeleteCategory(categoryId: number) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    setNotice(null);

    try {
      const response = await deleteCategory(userId, categoryId);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      setCategories((previous) =>
        previous.filter((category) => category.id !== categoryId),
      );
      removeCategoryColor(categoryId);
      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(
          error,
          "No se pudo eliminar la categoria.",
        ),
      });
    }
  }

  return (
    <DashboardLayout
      sectionTag="Finanzas"
      title="Categorias"
      subtitle="Organiza tus categorias."
    >
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-300/25 bg-black/35 p-4">
        <div class="inline-flex rounded-lg border border-violet-300/30 bg-violet-950/40 p-1">
          <button
            type="button"
            onClick={() => setActiveType("expense")}
            class={[
              "rounded-md px-3 py-1.5 text-sm transition",
              activeType === "expense"
                ? "bg-violet-700/70 text-violet-100"
                : "text-violet-300/90 hover:bg-violet-900/45",
            ].join(" ")}
          >
            Gastos
          </button>
          <button
            type="button"
            onClick={() => setActiveType("income")}
            class={[
              "rounded-md px-3 py-1.5 text-sm transition",
              activeType === "income"
                ? "bg-violet-700/70 text-violet-100"
                : "text-violet-300/90 hover:bg-violet-900/45",
            ].join(" ")}
          >
            Ingresos
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!userId || isLoading}
            class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60"
          >
            Nueva categoria
          </button>
          <SectionExportActions
            userId={userId}
            section="categories"
            disabled={!userId || isLoading || isSaving}
            onNotice={setNotice}
          />
        </div>
      </section>

      <section class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Total categorias
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {categories.length}
          </p>
        </article>

        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Gastos
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {expenseCategoriesCount}
          </p>
        </article>

        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Ingresos
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {incomeCategoriesCount}
          </p>
        </article>

        <article class="rounded-xl border border-violet-300/20 bg-black/30 px-4 py-3 sm:col-span-2 xl:col-span-1">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Movimiento mensual ({activeType === "expense" ? "gastos" : "ingresos"})
          </p>
          <p class="mt-1 text-lg font-semibold text-violet-100">
            {money.format(activeTypeMonthlyTotal)}
          </p>
        </article>
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-violet-100">
                Distribucion mensual
              </h3>
              <p class="text-xs text-violet-300/85">
                Participacion real por categoria en el mes actual.
              </p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {activeType === "expense" ? "Gastos" : "Ingresos"}
            </span>
          </header>

          {topCategory ? (
            <div class="mt-3 rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2">
              <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/80">
                Categoria principal
              </p>
              <p class="mt-1 text-sm font-semibold text-violet-100">
                {topCategory.name} · {money.format(topCategory.amount)} ({topCategory.share}%)
              </p>
            </div>
          ) : null}

          <div class="mt-3 space-y-3">
            {isLoading ? (
              <p class="rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
                Cargando categorias...
              </p>
            ) : distributionRows.length === 0 ? (
              <p class="rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
                Sin movimientos en este tipo de categoria.
              </p>
            ) : (
              distributionRows.map((category) => (
                <div key={category.id} class="rounded-lg border border-violet-300/20 bg-violet-950/20 p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <p class="text-sm font-medium text-violet-100">{category.name}</p>
                    </div>

                    <p class="text-sm font-semibold text-violet-100">
                      {money.format(category.amount)} · {category.share}%
                    </p>
                  </div>

                  <div class="mt-2 h-2 rounded-full bg-violet-900/35">
                    <div
                      class="h-full rounded-full"
                      style={{
                        width: `${category.share}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold text-violet-100">
                Catalogo de categorias
              </h3>
              <p class="text-xs text-violet-300/85">
                Gestiona categorias de {activeType === "expense" ? "gasto" : "ingreso"}.
              </p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {activeTypeCategories.length}
            </span>
          </header>

          <div class="mt-3 space-y-2">
            {isLoading ? (
              <p class="rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
                Cargando categorias...
              </p>
            ) : activeTypeCategories.length === 0 ? (
              <p class="rounded-lg bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/75">
                Sin categorias para este tipo.
              </p>
            ) : (
              activeTypeCategories.map((category) => (
                <div
                  key={category.id}
                  class="rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span
                        class="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <p class="text-sm text-violet-100">{category.name}</p>
                      <span class="rounded-full border border-violet-300/25 bg-black/25 px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-violet-300/90">
                        {toTypeLabel(category.type)}
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(category)}
                        disabled={isSaving}
                        class="rounded-md border border-violet-300/25 bg-black/25 px-2 py-1 text-xs text-violet-200 hover:border-violet-300/45"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteCategory(category.id)}
                        disabled={isSaving}
                        class="rounded-md border border-rose-300/30 bg-black/25 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/55"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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
                  {editingCategoryId === null
                    ? "Nueva categoria"
                    : "Editar categoria"}
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

            <form class="mt-4 grid gap-3" onSubmit={saveCategory}>
              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Nombre
                <input
                  type="text"
                  required
                  value={form.name}
                  onInput={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      name: event.currentTarget.value,
                    }))
                  }
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                />
              </label>

              <div class="grid gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Tipo
                  <select
                    value={form.type}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        type: event.currentTarget.value as CategoryType,
                      }))
                    }
                    class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </label>

                <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                  Color
                  <input
                    type="color"
                    value={form.color}
                    onInput={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        color: event.currentTarget.value,
                      }))
                    }
                    class="h-10.5 rounded-md border border-violet-300/35 bg-black/35 p-1"
                  />
                </label>
              </div>

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
                  class="rounded-md border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100"
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
