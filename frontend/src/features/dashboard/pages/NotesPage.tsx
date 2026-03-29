import { useEffect, useMemo, useState } from "preact/hooks";
import { useAuth } from "../../../platform/auth/AuthProvider";
import {
  createNote,
  deleteNote,
  listNotes,
  updateNote,
} from "../../../platform/pywebview/notes.api";
import type { NoteItem } from "../../../platform/pywebview/notes.api.types";
import { DashboardLayout } from "../components/DashboardLayout";
import { SectionExportActions } from "../components/SectionExportActions";
import { useKindNoticeToast } from "../../../shared/ui/useToastNotice";

type NoteForm = {
  title: string;
  content: string;
};

function toUiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message}`;
  }

  return fallback;
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

export function NotesPage() {
  const { session } = useAuth();
  const userId = session?.user_id ?? 0;

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useKindNoticeToast(notice, setNotice);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [form, setForm] = useState<NoteForm>({
    title: "",
    content: "",
  });

  const sortedNotes = useMemo(
    () =>
      [...notes].sort((a, b) => {
        const byUpdated = b.updated_at.localeCompare(a.updated_at);
        if (byUpdated !== 0) return byUpdated;
        return b.id - a.id;
      }),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch.length === 0) {
      return sortedNotes;
    }

    return sortedNotes.filter((note) => {
      const inTitle = note.title.toLowerCase().includes(normalizedSearch);
      const inContent = (note.content ?? "").toLowerCase().includes(normalizedSearch);
      return inTitle || inContent;
    });
  }, [searchTerm, sortedNotes]);

  const notesWithContentCount = useMemo(
    () => notes.filter((note) => (note.content ?? "").trim().length > 0).length,
    [notes],
  );

  const notesUpdatedToday = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDate = now.getDate();

    return notes.filter((note) => {
      const parsed = new Date(note.updated_at.replace(" ", "T"));
      if (Number.isNaN(parsed.getTime())) return false;

      return (
        parsed.getFullYear() === currentYear &&
        parsed.getMonth() === currentMonth &&
        parsed.getDate() === currentDate
      );
    }).length;
  }, [notes]);

  async function reloadNotes(currentUserId: number) {
    const response = await listNotes(currentUserId);
    if (!response.ok) {
      setNotes([]);
      setNotice({
        kind: "error",
        message: response.error ?? response.message,
      });
      return;
    }

    setNotes(response.data?.notes ?? []);
  }

  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setNotice(null);

      try {
        const response = await listNotes(userId);
        if (!isMounted) return;

        if (!response.ok) {
          setNotes([]);
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        setNotes(response.data?.notes ?? []);
      } catch (error) {
        if (!isMounted) return;
        setNotes([]);
        setNotice({
          kind: "error",
          message: toUiErrorMessage(error, "No se pudieron cargar las notas."),
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
    setEditingNoteId(null);
    setForm({ title: "", content: "" });
    setIsModalOpen(true);
  }

  function openEditModal(note: NoteItem) {
    setEditingNoteId(note.id);
    setForm({ title: note.title, content: note.content ?? "" });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingNoteId(null);
  }

  async function saveNote(event: SubmitEvent) {
    event.preventDefault();

    if (!userId) {
      setNotice({ kind: "error", message: "Sesión inválida." });
      return;
    }

    const normalizedTitle = form.title.trim();
    const normalizedContent = form.content.trim();

    if (!normalizedTitle) {
      setNotice({ kind: "error", message: "El título es obligatorio." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      if (editingNoteId !== null) {
        const response = await updateNote(
          userId,
          editingNoteId,
          normalizedTitle,
          normalizedContent,
        );

        if (!response.ok) {
          setNotice({
            kind: "error",
            message: response.error ?? response.message,
          });
          return;
        }

        await reloadNotes(userId);
        setNotice({ kind: "success", message: response.message });
        closeModal();
        return;
      }

      const response = await createNote(userId, normalizedTitle, normalizedContent);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadNotes(userId);
      setNotice({ kind: "success", message: response.message });
      closeModal();
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo guardar la nota."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeNote(noteId: number) {
    if (!userId) {
      setNotice({ kind: "error", message: "Sesión inválida." });
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await deleteNote(userId, noteId);
      if (!response.ok) {
        setNotice({
          kind: "error",
          message: response.error ?? response.message,
        });
        return;
      }

      await reloadNotes(userId);
      setNotice({ kind: "success", message: response.message });
    } catch (error) {
      setNotice({
        kind: "error",
        message: toUiErrorMessage(error, "No se pudo eliminar la nota."),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardLayout
      sectionTag="Notas"
      title="Notas"
      subtitle="Guarda tus notas."
    >
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-300/25 bg-black/35 p-4 shadow-[0_10px_20px_rgba(8,7,24,0.35)]">
        <div>
          <h3 class="text-sm font-semibold text-violet-100">Acciones de notas</h3>
          <p class="text-xs text-violet-300/85">
            Crea nuevas notas y exporta la colección actual.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!userId || isLoading}
            class="rounded-lg border border-violet-300/35 bg-violet-900/50 px-3 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-800/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Nueva nota
          </button>

          <SectionExportActions
            userId={userId}
            section="notes"
            disabled={!userId || isLoading || isSaving}
            onNotice={setNotice}
          />
        </div>
      </section>

      <section class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Total de notas
          </p>
          <p class="mt-1 text-xl font-semibold text-violet-100">{notes.length}</p>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Con contenido
          </p>
          <p class="mt-1 text-xl font-semibold text-violet-100">{notesWithContentCount}</p>
        </article>

        <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4 sm:col-span-2 xl:col-span-1">
          <p class="text-[11px] uppercase tracking-[0.08em] text-violet-300/85">
            Actualizadas hoy
          </p>
          <p class="mt-1 text-xl font-semibold text-violet-100">{notesUpdatedToday}</p>
        </article>
      </section>

      <section class="mt-7 grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="space-y-3">
          <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
            <h3 class="text-sm font-semibold text-violet-100">Buscar notas</h3>
            <p class="text-xs text-violet-300/85">Filtra por título o contenido.</p>

            <label class="mt-3 grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
              Buscar
              <input
                type="search"
                value={searchTerm}
                onInput={(event) => setSearchTerm(event.currentTarget.value)}
                placeholder="Ej. alquiler, ideas, tareas"
                class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none transition focus:border-violet-300/75"
              />
            </label>

            <p class="mt-3 text-xs text-violet-300/85">
              Mostrando {filteredNotes.length} de {notes.length} notas.
            </p>
          </article>

          <article class="rounded-2xl border border-violet-300/20 bg-black/35 p-4">
            <h3 class="text-sm font-semibold text-violet-100">Organización</h3>
            <p class="mt-2 text-sm text-violet-300/85">
              Las notas se ordenan automáticamente por fecha de actualización.
            </p>
          </article>
        </aside>

        <article class="rounded-2xl border border-violet-300/25 bg-black/35 p-4">
          <header class="flex items-center justify-between gap-2">
            <div>
              <h3 class="text-base font-semibold text-violet-100">Listado de notas</h3>
              <p class="text-xs text-violet-300/80">Vista principal de edición rápida.</p>
            </div>
            <span class="rounded-full border border-violet-300/30 bg-violet-900/30 px-2.5 py-1 text-xs font-semibold text-violet-100">
              {filteredNotes.length}
            </span>
          </header>

          {isLoading ? (
            <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
              Cargando notas...
            </p>
          ) : filteredNotes.length === 0 ? (
            <p class="mt-3 rounded-lg border border-violet-300/25 bg-violet-950/25 px-3 py-6 text-center text-sm text-violet-200/80">
              Sin notas para este filtro.
            </p>
          ) : (
            <div class="mt-3 grid gap-3 md:grid-cols-2">
              {filteredNotes.map((note) => (
                <article
                  key={note.id}
                  class="rounded-xl border border-violet-300/25 bg-violet-950/20 p-4"
                >
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-base font-semibold text-violet-100">{note.title}</h3>
                    <span class="text-xs text-violet-300/85">
                      {relativeDateLabel(note.updated_at)}
                    </span>
                  </div>

                  <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-violet-200/85">
                    {note.content || "Sin contenido"}
                  </p>

                  <p class="mt-3 text-[11px] uppercase tracking-[0.08em] text-violet-300/70">
                    Actualizada: {formatDateLabel(note.updated_at)}
                  </p>

                  <div class="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(note)}
                      disabled={isSaving}
                      class="rounded-md border border-violet-300/25 bg-black/25 px-2 py-1 text-xs text-violet-200 hover:border-violet-300/45 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeNote(note.id)}
                      disabled={isSaving}
                      class="rounded-md border border-rose-300/30 bg-black/25 px-2 py-1 text-xs text-rose-200 hover:border-rose-300/55 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>

      {isModalOpen ? (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div class="w-full max-w-xl rounded-2xl border border-violet-300/30 bg-[#130c2b] p-5 shadow-2xl">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.08em] text-violet-300/85">
                  Notas
                </p>
                <h3 class="mt-1 text-xl font-semibold text-violet-100">
                  {editingNoteId === null ? "Nueva nota" : "Editar nota"}
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

            <form class="mt-4 grid gap-3" onSubmit={(event) => void saveNote(event)}>
              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Título
                <input
                  type="text"
                  required
                  value={form.title}
                  onInput={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.currentTarget.value,
                    }))
                  }
                  class="rounded-md border border-violet-300/35 bg-black/35 px-2 py-2 text-sm text-violet-100 outline-none"
                />
              </label>

              <label class="grid gap-1 text-xs uppercase tracking-[0.08em] text-violet-300/90">
                Contenido
                <textarea
                  rows={7}
                  value={form.content}
                  onInput={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      content: event.currentTarget.value,
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
