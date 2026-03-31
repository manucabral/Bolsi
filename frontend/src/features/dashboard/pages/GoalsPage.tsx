import { useEffect, useMemo, useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import {
  addSavingsEntry,
  createSavingsGoal,
  deleteSavingsGoal,
  listSavingsGoals,
  updateSavingsGoalTarget,
} from "../../../platform/pywebview/savings.api";
import type { SavingsGoalItem } from "../../../platform/pywebview/savings.api.types";
import { DashboardLayout } from "../components/DashboardLayout";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type GoalForm = {
  name: string;
  target: string;
  deadline: string;
  color: string;
  affectsBalance: boolean;
};

type EntryForm = {
  amount: string;
  note: string;
  date: string;
};

const DEFAULT_GOAL_COLOR = "#14b8a6";

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

function toISODate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompactDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(parsed)
    .replace(" de ", " ")
    .replace(" de ", " ");
}

function monthsUntilDeadline(deadline: string) {
  const today = new Date();
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return null;
  }

  const years = due.getFullYear() - today.getFullYear();
  const months = due.getMonth() - today.getMonth();
  let totalMonths = years * 12 + months;

  if (due.getDate() < today.getDate()) {
    totalMonths -= 1;
  }

  return totalMonths;
}

function buildDeadlineHint(goal: SavingsGoalItem) {
  const deadline = goal.deadline?.trim();
  if (!deadline) return null;

  const monthsLeft = monthsUntilDeadline(deadline);
  if (monthsLeft === null) {
    return `Limite ${formatCompactDate(deadline)}`;
  }

  if (monthsLeft < 0) {
    return "Meta vencida";
  }

  if (monthsLeft === 0) {
    return "Vence este mes";
  }

  if (monthsLeft === 1) {
    return "Falta 1 mes";
  }

  return `Faltan ${monthsLeft} meses`;
}

function createEmptyGoalForm(): GoalForm {
  return {
    name: "",
    target: "",
    deadline: "",
    color: DEFAULT_GOAL_COLOR,
    affectsBalance: true,
  };
}

function createEmptyEntryForm(): EntryForm {
  return {
    amount: "",
    note: "",
    date: toISODate(new Date()),
  };
}

export function GoalsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const [goals, setGoals] = useState<SavingsGoalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalForm>(createEmptyGoalForm());
  const [isEditTargetModalOpen, setIsEditTargetModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState("");

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [entryForm, setEntryForm] = useState<EntryForm>(createEmptyEntryForm());

  useKindNoticeToast(notice, setNotice);

  const money = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const editingGoal = useMemo(
    () => goals.find((goal) => goal.id === editingGoalId) ?? null,
    [goals, editingGoalId],
  );

  const totals = useMemo(() => {
    const target = goals.reduce((sum, goal) => sum + goal.target, 0);
    const current = goals.reduce((sum, goal) => sum + goal.current, 0);

    return {
      target,
      current,
      remaining: Math.max(target - current, 0),
      count: goals.length,
    };
  }, [goals]);

  const sortedGoals = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const byProgress = b.progress - a.progress;
        if (byProgress !== 0) return byProgress;
        return b.id - a.id;
      }),
    [goals],
  );

  async function reloadGoals(currentUserId: number) {
    const response = await listSavingsGoals(currentUserId);
    if (!response.ok) {
      setGoals([]);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    setGoals(response.data?.goals ?? []);
  }

  useEffect(() => {
    if (!userId) {
      setGoals([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const response = await listSavingsGoals(userId);
        if (!isMounted) return;

        if (!response.ok) {
          setGoals([]);
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        setGoals(response.data?.goals ?? []);
      } catch (error) {
        if (!isMounted) return;
        setGoals([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(error, "No se pudieron cargar las metas."),
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

  function openCreateGoalModal() {
    setGoalForm(createEmptyGoalForm());
    setIsGoalModalOpen(true);
  }

  function closeCreateGoalModal() {
    setIsGoalModalOpen(false);
  }

  function openEditTargetModal(goal: SavingsGoalItem) {
    setEditingGoalId(goal.id);
    setEditingTarget(String(goal.target));
    setIsEditTargetModalOpen(true);
  }

  function closeEditTargetModal() {
    setIsEditTargetModalOpen(false);
    setEditingGoalId(null);
    setEditingTarget("");
  }

  function openAddEntryModal(goalId: number) {
    setSelectedGoalId(goalId);
    setEntryForm(createEmptyEntryForm());
    setIsEntryModalOpen(true);
  }

  function closeAddEntryModal() {
    setIsEntryModalOpen(false);
    setSelectedGoalId(null);
  }

  async function saveGoal(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const normalizedName = goalForm.name.trim();
    const target = Number(goalForm.target);
    const normalizedDeadline = goalForm.deadline.trim();
    const normalizedColor = goalForm.color.trim();

    if (!normalizedName) {
      setNotice({ kind: "error", message: "El nombre es obligatorio." });
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      setNotice({ kind: "error", message: "El objetivo debe ser mayor a 0." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await createSavingsGoal(
        userId,
        normalizedName,
        target,
        normalizedDeadline || undefined,
        normalizedColor || undefined,
        goalForm.affectsBalance,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadGoals(userId);
      setNotice({ kind: "success", message: response.message });
      closeCreateGoalModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo crear la meta."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEntry(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    if (!selectedGoalId) {
      setNotice({ kind: "error", message: "Meta invalida." });
      return;
    }

    const amount = Number(entryForm.amount);
    const normalizedNote = entryForm.note.trim();
    const normalizedDate = entryForm.date.trim();
    const goalAffectsBalance = selectedGoal?.affects_balance ?? true;

    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ kind: "error", message: "El ahorro debe ser mayor a 0." });
      return;
    }

    if (!normalizedDate) {
      setNotice({ kind: "error", message: "La fecha es obligatoria." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await addSavingsEntry(
        userId,
        selectedGoalId,
        amount,
        normalizedNote,
        normalizedDate,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadGoals(userId);
      const txId = response.generated_transaction_id;
      let details = "";
      if (typeof txId === "number") {
        details = ` Transaccion #${txId}.`;
      } else if (!goalAffectsBalance) {
        details = " No descuenta del balance mensual.";
      }
      setNotice({
        kind: "success",
        message: `${response.message}.${details}`.replace("..", "."),
      });
      closeAddEntryModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo registrar el ahorro."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveGoalTarget(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    if (!editingGoalId) {
      setNotice({ kind: "error", message: "Meta invalida." });
      return;
    }

    const target = Number(editingTarget);
    if (!Number.isFinite(target) || target <= 0) {
      setNotice({ kind: "error", message: "El objetivo debe ser mayor a 0." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await updateSavingsGoalTarget(userId, editingGoalId, target);

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadGoals(userId);
      setNotice({ kind: "success", message: response.message });
      closeEditTargetModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo actualizar el objetivo."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeGoal(goal: SavingsGoalItem) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesion invalida." });
      return;
    }

    const shouldDelete = window.confirm(
      `Vas a eliminar la meta \"${goal.name}\". Esta accion no se puede deshacer.`,
    );
    if (!shouldDelete) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await deleteSavingsGoal(userId, goal.id);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadGoals(userId);
      if (selectedGoalId === goal.id) {
        closeAddEntryModal();
      }
      if (editingGoalId === goal.id) {
        closeEditTargetModal();
      }

      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo eliminar la meta."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardLayout
      title="Metas de ahorro"
      subtitle="Define objetivos y decide por meta si cada ahorro descuenta o no del balance mensual."
    >
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
        <div>
          <h3 class="text-sm font-semibold text-violet-100">Gestion de metas</h3>
          <p class="text-xs text-violet-300/85">
            Configura por meta si los aportes impactan el balance mensual.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateGoalModal}
          disabled={!userId || isLoading}
          class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Nueva meta
        </button>
      </section>

      <section class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">Metas</p>
          <p class="mt-1 text-xl font-semibold text-violet-100">{totals.count}</p>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">Acumulado</p>
          <p class="mt-1 text-xl font-semibold text-teal-300">{money.format(totals.current)}</p>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">Objetivo total</p>
          <p class="mt-1 text-xl font-semibold text-violet-100">{money.format(totals.target)}</p>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">Restante</p>
          <p class="mt-1 text-xl font-semibold text-red-300">{money.format(totals.remaining)}</p>
        </article>
      </section>

      <section class="mt-4 rounded-2xl border border-violet-300/25 bg-black/35 p-4">
        <header class="flex items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold text-violet-100">Listado de metas</h3>
            <p class="text-xs text-violet-300/80">Progreso, objetivo y ahorro acumulado por meta.</p>
          </div>
          <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
            {sortedGoals.length}
          </span>
        </header>

        {isLoading ? (
          <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
            Cargando metas...
          </p>
        ) : sortedGoals.length === 0 ? (
          <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
            Aun no tenes metas. Crea una para comenzar a separar ahorro.
          </p>
        ) : (
          <div class="mt-3 grid gap-3 md:grid-cols-2">
            {sortedGoals.map((goal) => {
              const progressPercent = Math.round(goal.progress * 100);
              const deadlineHint = buildDeadlineHint(goal);
              const barColor = goal.color?.trim() || DEFAULT_GOAL_COLOR;

              return (
                <article
                  key={goal.id}
                  class="rounded-xl border border-violet-300/25 bg-violet-950/20 p-4"
                >
                  <div class="flex items-start justify-between gap-2">
                    <h4 class="text-base font-semibold text-violet-100">{goal.name}</h4>
                    <div class="flex flex-col items-end gap-1">
                      <span class="rounded-md border border-violet-300/25 bg-violet-900/30 px-2 py-1 text-[11px] font-semibold text-violet-100">
                        {progressPercent}%
                      </span>
                      <span
                        class={[
                          "rounded-md border px-2 py-1 text-[11px] font-medium",
                          goal.affects_balance
                            ? "border-teal-300/35 bg-teal-500/15 text-teal-100"
                            : "border-sky-300/35 bg-sky-400/15 text-sky-100",
                        ].join(" ")}
                      >
                        {goal.affects_balance ? "Descuenta balance" : "No descuenta balance"}
                      </span>
                    </div>
                  </div>

                  <div class="mt-3 h-3 overflow-hidden rounded-full bg-violet-900/45">
                    <div
                      class="h-full rounded-full"
                      style={{
                        width: `${Math.max(progressPercent, 1)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>

                  <p class="mt-2 text-sm text-violet-200/90">
                    {money.format(goal.current)} / {money.format(goal.target)}
                    {deadlineHint ? ` · ${deadlineHint}` : ""}
                  </p>

                  <div class="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => openAddEntryModal(goal.id)}
                      class="rounded-md border border-teal-300/35 bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Agregar ahorro
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => openEditTargetModal(goal)}
                      class="rounded-md border border-amber-300/35 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Editar objetivo
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void removeGoal(goal)}
                      class="rounded-md border border-red-300/35 bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Eliminar meta
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isGoalModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#17142d] p-5 shadow-[0_22px_50px_rgba(7,6,20,0.55)]">
            <h3 class="text-lg font-semibold text-violet-100">Nueva meta de ahorro</h3>

            <form class="mt-4 grid gap-3" onSubmit={saveGoal}>
              <label class="grid gap-1 text-sm text-violet-100">
                Meta
                <input
                  required
                  type="text"
                  value={goalForm.name}
                  onInput={(event) =>
                    setGoalForm((previous) => ({
                      ...previous,
                      name: event.currentTarget.value,
                    }))
                  }
                  placeholder="Vacaciones 2026"
                  class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                />
              </label>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-sm text-violet-100">
                  Objetivo
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={goalForm.target}
                    onInput={(event) =>
                      setGoalForm((previous) => ({
                        ...previous,
                        target: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>

                <label class="grid gap-1 text-sm text-violet-100">
                  Fecha limite
                  <input
                    type="date"
                    value={goalForm.deadline}
                    onInput={(event) =>
                      setGoalForm((previous) => ({
                        ...previous,
                        deadline: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>
              </div>

              <label class="grid gap-1 text-sm text-violet-100">
                Color de progreso
                <input
                  type="color"
                  value={goalForm.color}
                  onInput={(event) =>
                    setGoalForm((previous) => ({
                      ...previous,
                      color: event.currentTarget.value,
                    }))
                  }
                  class="h-10 w-full rounded-md border border-violet-300/25 bg-violet-950/35 px-2 py-1"
                />
              </label>

              <label class="flex items-start gap-2 rounded-md border border-violet-300/20 bg-violet-950/20 px-3 py-2 text-sm text-violet-100">
                <input
                  type="checkbox"
                  checked={goalForm.affectsBalance}
                  onInput={(event) =>
                    setGoalForm((previous) => ({
                      ...previous,
                      affectsBalance: event.currentTarget.checked,
                    }))
                  }
                  class="mt-0.5 h-4 w-4 accent-violet-500"
                />
                <span>
                  Descontar del balance mensual?
                  <span class="mt-0.5 block text-xs text-violet-300/85">
                    Si esta activado, cada ahorro se registra como gasto mensual.
                  </span>
                </span>
              </label>

              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeCreateGoalModal}
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

      {isEditTargetModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#17142d] p-5 shadow-[0_22px_50px_rgba(7,6,20,0.55)]">
            <h3 class="text-lg font-semibold text-violet-100">Editar objetivo de meta</h3>
            <p class="mt-1 text-sm text-violet-300/90">
              Meta: {editingGoal?.name ?? "Meta"}
            </p>

            <form class="mt-4 grid gap-3" onSubmit={saveGoalTarget}>
              <label class="grid gap-1 text-sm text-violet-100">
                Nuevo objetivo
                <input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={editingTarget}
                  onInput={(event) => setEditingTarget(event.currentTarget.value)}
                  class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                />
              </label>

              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeEditTargetModal}
                  class="rounded-md border border-violet-300/25 bg-violet-900/25 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-800/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  class="rounded-md border border-amber-300/35 bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Actualizar objetivo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isEntryModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#17142d] p-5 shadow-[0_22px_50px_rgba(7,6,20,0.55)]">
            <h3 class="text-lg font-semibold text-violet-100">+ Agregar ahorro</h3>
            <p class="mt-1 text-sm text-violet-300/90">
              Meta: {selectedGoal?.name ?? "Meta"}
            </p>

            <form class="mt-4 grid gap-3" onSubmit={saveEntry}>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label class="grid gap-1 text-sm text-violet-100">
                  Monto
                  <input
                    required
                    type="number"
                    min="1"
                    step="0.01"
                    value={entryForm.amount}
                    onInput={(event) =>
                      setEntryForm((previous) => ({
                        ...previous,
                        amount: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>

                <label class="grid gap-1 text-sm text-violet-100">
                  Fecha
                  <input
                    required
                    type="date"
                    value={entryForm.date}
                    onInput={(event) =>
                      setEntryForm((previous) => ({
                        ...previous,
                        date: event.currentTarget.value,
                      }))
                    }
                    class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                  />
                </label>
              </div>

              <label class="grid gap-1 text-sm text-violet-100">
                Nota
                <input
                  type="text"
                  value={entryForm.note}
                  onInput={(event) =>
                    setEntryForm((previous) => ({
                      ...previous,
                      note: event.currentTarget.value,
                    }))
                  }
                  placeholder="Opcional"
                  class="rounded-md border border-violet-300/25 bg-violet-950/35 px-3 py-2 text-sm text-violet-100"
                />
              </label>

              <div class="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeAddEntryModal}
                  class="rounded-md border border-violet-300/25 bg-violet-900/25 px-3 py-2 text-sm text-violet-100 transition hover:bg-violet-800/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  class="rounded-md border border-teal-300/35 bg-teal-500/20 px-3 py-2 text-sm font-medium text-teal-100 transition hover:bg-teal-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "Guardando..." : "Agregar ahorro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
