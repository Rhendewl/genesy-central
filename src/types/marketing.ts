export const MARKETING_PLATFORMS = ["instagram", "linkedin", "tiktok", "youtube", "blog", "email", "other"] as const;
export const MARKETING_FORMATS = ["reel", "carousel", "static_post", "story", "video", "article", "email", "other"] as const;
export const MARKETING_CONTENT_STATUSES = ["planned", "in_production", "in_review", "approved", "scheduled", "published", "cancelled"] as const;
export const MARKETING_IDEA_STATUSES = ["new", "evaluating", "approved", "converted", "archived"] as const;
export const MARKETING_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const MARKETING_ASSET_CATEGORIES = ["logos", "photos", "videos", "mockups", "templates", "documents", "other"] as const;

export type MarketingPlatform = typeof MARKETING_PLATFORMS[number];
export type MarketingFormat = typeof MARKETING_FORMATS[number];
export type MarketingContentStatus = typeof MARKETING_CONTENT_STATUSES[number];
export type MarketingIdeaStatus = typeof MARKETING_IDEA_STATUSES[number];
export type MarketingPriority = typeof MARKETING_PRIORITIES[number];
export type MarketingAssetCategory = typeof MARKETING_ASSET_CATEGORIES[number];

export interface MarketingMember { id: string; auth_user_id: string; full_name: string; avatar_url: string | null; role: string; }
export interface MarketingContent {
  id: string; organization_id: string; origin_idea_id: string | null; workspace_task_id: string | null; title: string; description: string | null;
  status: MarketingContentStatus; platform: MarketingPlatform; format: MarketingFormat; scheduled_at: string | null; delivery_at: string | null;
  published_at: string | null; primary_assignee_id: string | null; priority: MarketingPriority; caption: string | null;
  script: string | null; cta: string | null; notes: string | null; thumbnail_url: string | null; reference_links: string[];
  publication_url: string | null; manual_publication: boolean; post_publication_notes: string | null; workspace_tag_ids: string[];
  created_by: string; updated_by: string | null; created_at: string; updated_at: string; archived_at: string | null;
  assignee_ids: string[]; asset_ids: string[]; tag_names: string[]; checklist: MarketingChecklistItem[]; comments: MarketingComment[]; can_edit: boolean; can_delete: boolean;
}
export interface MarketingIdea {
  id: string; organization_id: string; title: string; description: string | null; category: string | null;
  suggested_platform: MarketingPlatform | null; suggested_format: MarketingFormat | null; status: MarketingIdeaStatus;
  priority: MarketingPriority; suggested_assignee_id: string | null; reference_links: string[]; created_by: string;
  created_at: string; updated_at: string; archived_at: string | null; tag_names: string[]; can_edit: boolean; can_delete: boolean;
}
export interface MarketingAsset {
  id: string; organization_id: string; name: string; category: MarketingAssetCategory; mime_type: string; file_size: number | null;
  storage_path: string; public_url: string; tags: string[]; created_by: string; created_at: string; archived_at: string | null;
  can_manage: boolean; usage_count: number;
}
export interface MarketingChecklistItem { id: string; content_id: string; label: string; is_completed: boolean; position: number; }
export interface MarketingComment { id: string; content_id: string; body: string; author_profile_id: string | null; created_by: string; created_at: string; }

export type MarketingContentInput = Partial<Omit<MarketingContent, "id" | "organization_id" | "created_by" | "updated_by" | "created_at" | "updated_at" | "archived_at" | "checklist" | "comments" | "can_edit" | "can_delete">> & {
  title: string;
  // Opção transitória usada apenas pela API para criar e vincular a tarefa.
  create_workspace_task?: boolean;
};
export type MarketingIdeaInput = Partial<Omit<MarketingIdea, "id" | "organization_id" | "created_by" | "created_at" | "updated_at" | "archived_at" | "can_edit" | "can_delete">> & { title: string };

export const PLATFORM_LABELS: Record<MarketingPlatform, string> = { instagram: "Instagram", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", blog: "Blog", email: "E-mail", other: "Outros" };
export const FORMAT_LABELS: Record<MarketingFormat, string> = { reel: "Reel", carousel: "Carrossel", static_post: "Post estático", story: "Story", video: "Vídeo", article: "Artigo", email: "E-mail", other: "Outro" };
export const CONTENT_STATUS_LABELS: Record<MarketingContentStatus, string> = { planned: "Planejado", in_production: "Em produção", in_review: "Em revisão", approved: "Aprovado", scheduled: "Agendado", published: "Publicado", cancelled: "Cancelado" };
export const IDEA_STATUS_LABELS: Record<MarketingIdeaStatus, string> = { new: "Nova", evaluating: "Em avaliação", approved: "Aprovada", converted: "Transformada", archived: "Arquivada" };
export const PRIORITY_LABELS: Record<MarketingPriority, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
export const ASSET_CATEGORY_LABELS: Record<MarketingAssetCategory, string> = { logos: "Logos", photos: "Fotos", videos: "Vídeos", mockups: "Mockups", templates: "Templates", documents: "Documentos", other: "Outros" };
