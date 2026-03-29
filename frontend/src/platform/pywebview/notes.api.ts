import { getBolsiApi } from "./pywebview";
import type {
  CreateNoteResult,
  DeleteNoteResult,
  ListNotesResult,
  UpdateNoteResult,
} from "./notes.api.types";

export async function listNotes(userId: number): Promise<ListNotesResult> {
  const api = await getBolsiApi();
  return api.notes_list(userId);
}

export async function createNote(
  userId: number,
  title: string,
  content: string,
): Promise<CreateNoteResult> {
  const api = await getBolsiApi();
  return api.notes_create(userId, title, content);
}

export async function updateNote(
  userId: number,
  noteId: number,
  title: string,
  content: string,
): Promise<UpdateNoteResult> {
  const api = await getBolsiApi();
  return api.notes_update(userId, noteId, title, content);
}

export async function deleteNote(
  userId: number,
  noteId: number,
): Promise<DeleteNoteResult> {
  const api = await getBolsiApi();
  return api.notes_delete(userId, noteId);
}
