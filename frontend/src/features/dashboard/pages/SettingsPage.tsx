import { useEffect, useMemo, useState } from "preact/hooks";
import { DashboardLayout } from "../components/DashboardLayout";
import {
  backupDatabase,
  listDatabaseBackups,
  restoreDatabase,
} from "../../../platform/pywebview/settings.api";
import type { BackupItem } from "../../../platform/pywebview/settings.api.types";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");
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

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        await reloadBackups();
      } catch (error) {
        if (!isMounted) return;
        setBackups([]);
        setSelectedBackup("");
        setNotice({
          kind: "error",
          message: toUiErrorMessage(error, "No se pudieron cargar los backups."),
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
  }, []);

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
      sectionTag="Sistema"
      title="Configuracion"
      subtitle="Gestion de copias de seguridad de la base local."
    >
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
              class="rounded-lg border border-rose-300/35 bg-rose-900/35 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-800/45 disabled:cursor-not-allowed disabled:opacity-55"
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
