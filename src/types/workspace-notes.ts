import type { JSONContent } from "@tiptap/react";

export interface WorkspaceNoteSummary {
  id:         string;
  title:      string;
  cover_url:  string | null;
  color:      string | null;
  tags:       string[];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceNote extends WorkspaceNoteSummary {
  user_id:    string;
  created_by: string;
  content:    JSONContent;
}

export type NewWorkspaceNote = Partial<Pick<WorkspaceNote,
  "title" | "content" | "cover_url" | "color" | "tags"
>>;

export type UpdateWorkspaceNote = Partial<Pick<WorkspaceNote,
  "title" | "content" | "cover_url" | "color" | "tags"
>>;
