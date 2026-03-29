import type { ApiResponse } from "./user.api.types";

export interface NoteItem {
  id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type ListNotesResult = ApiResponse<{
  notes?: NoteItem[];
  [key: string]: unknown;
}>;

export type CreateNoteResult = ApiResponse<{
  note?: NoteItem;
  [key: string]: unknown;
}>;

export type UpdateNoteResult = ApiResponse<{
  note?: NoteItem;
  [key: string]: unknown;
}>;

export type DeleteNoteResult = ApiResponse<Record<string, unknown>>;
