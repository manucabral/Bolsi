import { useEffect, useMemo, useState } from "preact/hooks";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  backupDatabase,
  getNotificationSettings,
  listDatabaseBackups,
  restoreDatabase,
  updateNotificationSettings,
} from "../../../platform/pywebview/settings.api";
import { useAuth } from "../../../platform/auth/AuthProvider";
import type {
  BackupItem,
  NotificationPreferences,
} from "../../../platform/pywebview/settings.api.types";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

const DAY_OPTIONS = [1, 3, 7] as const;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
}

export function SettingsPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationPreferences | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useKindNoticeToast(notice, setNotice);

  const latestBackup = useMemo(() => backups[0] ?? null, [backups]);

  async function reloadBackups() {
    const response = await listDatabaseBackups();
    if (!response.ok) {
      setBackups([]);
      setSelectedBackup("");
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    const rows = response.data?.backups ?? response.backups ?? [];
    setBackups(rows);

    if (rows.length === 0) {
      setSelectedBackup("");
      return;
    }

    if (!rows.some((item) => item.file_name === selectedBackup)) {
      setSelectedBackup(rows[0].file_name);
    }
  }

  async function reloadNotificationSettings() {
    if (!userId) {
      setNotificationSettings(null);
      return;
    }

    const response = await getNotificationSettings(userId);
    if (!response.ok) {
      setNotificationSettings(null);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    const settings = response.data?.notifications ?? response.notifications;
    if (!settings) {
      setNotificationSettings(null);
      return;
    }

    setNotificationSettings(settings);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setIsLoadingNotifications(true);
      setNotice(null);

      try {
        await Promise.all([reloadBackups(), reloadNotificationSettings()]);
      } catch (error) {
        if (!isMounted) return;
        setBackups([]);
        setSelectedBackup("");
        setNotificationSettings(null);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(error, "No se pudieron cargar los backups."),
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingNotifications(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  async function handleSaveNotificationSettings() {
    if (!notificationSettings || !userId) {
      return;
    }

    setIsSavingNotifications(true);
    setNotice(null);

    try {
      const response = await updateNotificationSettings(
        userId,
        notificationSettings.bills_enabled,
        notificationSettings.bills_days_before,
        notificationSettings.credits_enabled,
        notificationSettings.credits_days_before,
        notificationSettings.summary_on_open_enabled,
      );

      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      const updated = response.data?.notifications ?? response.notifications;
      if (updated) {
        setNotificationSettings(updated);
      }

      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudieron guardar las notificaciones."),
      });
    } finally {
      setIsSavingNotifications(false);
    }
  }

  async function handleCreateBackup() {
    setIsCreatingBackup(true);
    setNotice(null);

    try {
      const response = await backupDatabase();
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      setNotice({ kind: "success", message: response.message });
      await reloadBackups();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo crear el backup."),
      });
    } finally {
      setIsCreatingBackup(false);
    }
  }

  async function handleRestoreBackup() {
    if (!selectedBackup) {
      setNotice({ kind: "error", message: "Selecciona un backup para restaurar." });
      return;
    }

    const confirmed = window.confirm(
      "Se restaurará la base desde el backup seleccionado. Esta acción reemplaza los datos actuales. ¿Continuar?",
    );
    if (!confirmed) {
      return;
    }

    setIsRestoringBackup(true);
    setNotice(null);

    try {
      const response = await restoreDatabase(selectedBackup);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      setNotice({ kind: "success", message: response.message });
      await reloadBackups();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo restaurar el backup."),
      });
    } finally {
      setIsRestoringBackup(false);
    }
  }

  return (
    <DashboardLayout
      title="Configuracion"
      subtitle="Gestion de copias de seguridad de la base local."
    >
      <section class="mb-3 rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
        <header class="border-b border-violet-300/20 pb-3">
          <h3 class="text-sm font-semibold text-violet-100">Notificaciones</h3>
          <p class="mt-1 text-xs text-violet-300/85">
            Al iniciar la app, alertar sobre proximos vencimientos.
          </p>
        </header>

        {isLoadingNotifications ? (
          <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-5 text-center text-sm text-violet-200/75">
            Cargando preferencias...
          </p>
        ) : !notificationSettings ? (
          <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-5 text-center text-sm text-violet-200/75">
            No se pudieron cargar las preferencias de notificaciones.
          </p>
        ) : (
          <div class="mt-3 grid gap-3">
            <article class="rounded-xl border border-violet-300/20 bg-violet-950/15 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-violet-100">Facturas por vencer</p>
                <input
                  type="checkbox"
                  checked={notificationSettings.bills_enabled}
                  onInput={(event) =>
                    setNotificationSettings((previous) =>
                      previous
                        ? { ...previous, bills_enabled: event.currentTarget.checked }
                        : previous,
                    )
                  }
                  class="h-4 w-4 cursor-pointer accent-violet-500"
                />
              </div>

              <label class="mt-2 flex items-center gap-2 text-xs text-violet-300/85">
                Dias de anticipacion
                <select
                  value={String(notificationSettings.bills_days_before)}
                  disabled={!notificationSettings.bills_enabled}
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    setNotificationSettings((previous) =>
                      previous ? { ...previous, bills_days_before: value } : previous,
                    );
                  }}
                  class="rounded-md border border-violet-300/30 bg-black/30 px-2 py-1 text-xs text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={`bills-day-${day}`} value={String(day)}>
                      {day} dia{day === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </article>

            <article class="rounded-xl border border-violet-300/20 bg-violet-950/15 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-violet-100">Cuotas por vencer</p>
                <input
                  type="checkbox"
                  checked={notificationSettings.credits_enabled}
                  onInput={(event) =>
                    setNotificationSettings((previous) =>
                      previous
                        ? { ...previous, credits_enabled: event.currentTarget.checked }
                        : previous,
                    )
                  }
                  class="h-4 w-4 cursor-pointer accent-violet-500"
                />
              </div>

              <label class="mt-2 flex items-center gap-2 text-xs text-violet-300/85">
                Dias de anticipacion
                <select
                  value={String(notificationSettings.credits_days_before)}
                  disabled={!notificationSettings.credits_enabled}
                  onChange={(event) => {
                    const value = Number(event.currentTarget.value);
                    setNotificationSettings((previous) =>
                      previous ? { ...previous, credits_days_before: value } : previous,
                    );
                  }}
                  class="rounded-md border border-violet-300/30 bg-black/30 px-2 py-1 text-xs text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {DAY_OPTIONS.map((day) => (
                    <option key={`credits-day-${day}`} value={String(day)}>
                      {day} dia{day === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
            </article>

            <article class="rounded-xl border border-violet-300/20 bg-violet-950/15 p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-medium text-violet-100">Resumen al abrir</p>
                <input
                  type="checkbox"
                  checked={notificationSettings.summary_on_open_enabled}
                  onInput={(event) =>
                    setNotificationSettings((previous) =>
                      previous
                        ? {
                            ...previous,
                            summary_on_open_enabled: event.currentTarget.checked,
                          }
                        : previous,
                    )
                  }
                  class="h-4 w-4 cursor-pointer accent-violet-500"
                />
              </div>
              <p class="mt-2 text-xs text-violet-300/85">
                Muestra un resumen del mes despues de iniciar sesion.
              </p>
            </article>

            <div>
              <button
                type="button"
                onClick={() => void handleSaveNotificationSettings()}
                disabled={isSavingNotifications}
                class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isSavingNotifications ? "Guardando..." : "Guardar notificaciones"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section class="grid gap-3 lg:grid-cols-[1fr_1.35fr]">
        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <h3 class="text-sm font-semibold text-violet-100">Base de datos</h3>
          <p class="mt-1 text-xs text-violet-300/85">
            Crea backups y restaura una copia cuando lo necesites.
          </p>

          <div class="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => void handleCreateBackup()}
              disabled={isCreatingBackup || isRestoringBackup}
              class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isCreatingBackup ? "Creando backup..." : "Crear backup"}
            </button>

            <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Backup para restaurar
              <select
                value={selectedBackup}
                onChange={(event) => setSelectedBackup(event.currentTarget.value)}
                disabled={isLoading || backups.length === 0 || isRestoringBackup}
                class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
              >
                {backups.length === 0 ? (
                  <option value="">Sin backups</option>
                ) : (
                  backups.map((backup) => (
                    <option key={backup.file_name} value={backup.file_name}>
                      {backup.file_name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleRestoreBackup()}
              disabled={!selectedBackup || isCreatingBackup || isRestoringBackup}
              class="rounded-lg border border-red-300/35 bg-red-900/35 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-800/45 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {isRestoringBackup ? "Restaurando..." : "Restaurar backup"}
            </button>
          </div>

          <p class="mt-3 rounded-lg border border-violet-300/20 bg-violet-950/20 px-3 py-2 text-xs text-violet-200/85">
            Recomendacion: crear un backup antes de restaurar para no perder el estado actual.
          </p>
        </article>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
          <header class="flex items-center justify-between gap-2 border-b border-violet-300/20 pb-3">
            <div>
              <h3 class="text-sm font-semibold text-violet-100">Historial de backups</h3>
              <p class="text-xs text-violet-300/85">
                {backups.length} archivo{backups.length === 1 ? "" : "s"}
              </p>
            </div>
            {latestBackup ? (
              <span class="rounded-full border border-violet-300/30 bg-violet-900/35 px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-violet-100">
                Ultimo: {formatDateTime(latestBackup.updated_at)}
              </span>
            ) : null}
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/75">
              Cargando backups...
            </p>
          ) : backups.length === 0 ? (
            <p class="mt-3 rounded-lg bg-violet-950/25 px-3 py-8 text-center text-sm text-violet-200/75">
              No hay copias de seguridad creadas.
            </p>
          ) : (
            <div class="mt-3 overflow-x-auto">
              <table class="w-full table-fixed border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr class="text-left text-xs uppercase tracking-[0.08em] text-violet-300/80">
                    <th class="px-2 font-medium">Archivo</th>
                    <th class="px-2 font-medium">Actualizado</th>
                    <th class="px-2 text-right font-medium">Tamaño</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map((backup) => (
                    <tr key={backup.file_name} class="rounded-lg bg-violet-950/30 text-violet-100">
                      <td class="rounded-l-lg px-2 py-2 break-all">{backup.file_name}</td>
                      <td class="px-2 py-2 text-violet-200/85">{formatDateTime(backup.updated_at)}</td>
                      <td class="rounded-r-lg px-2 py-2 text-right font-semibold text-violet-100">
                        {formatSize(backup.size_bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}


