import type { JSONContent } from "@tiptap/react";

export interface WorkspaceNoteSummary {
  id:         string;
  title:      string;
  cover_url:  string | null;
  color:      string | null;
  tags:       string[];
  folder_id:  string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceNote extends WorkspaceNoteSummary {
  user_id:    string;
  created_by: string;
  content:    JSONContent;
}

export type NewWorkspaceNote = Partial<Pick<WorkspaceNote,
  "title" | "content" | "cover_url" | "color" | "tags" | "folder_id"
>>;

export type UpdateWorkspaceNote = Partial<Pick<WorkspaceNote,
  "title" | "content" | "cover_url" | "color" | "tags" | "folder_id"
>>;

// ── Pastas de notas ────────────────────────────────────────────────────────────

export interface WorkspaceNoteFolder {
  id:          string;
  user_id:     string;
  created_by:  string;
  name:        string;
  color:       string | null;
  tags:        string[];
  client_id:   string | null;
  order_index: number;
  created_at:  string;
  updated_at:  string;
  /** Só presente na listagem (GET) — contagem de notas na pasta. */
  note_count?: number;
  /** Só presente na listagem (GET) quando client_id existe — nome do cliente vinculado. */
  client_name?: string | null;
}

export type NewWorkspaceNoteFolder = Partial<Pick<WorkspaceNoteFolder,
  "name" | "color" | "tags" | "client_id" | "order_index"
>>;

export type UpdateWorkspaceNoteFolder = Partial<Pick<WorkspaceNoteFolder,
  "name" | "color" | "tags" | "client_id" | "order_index"
>>;
