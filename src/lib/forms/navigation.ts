import type { FormOrigin } from "@/types";

export type FormFolderSelection = "root" | "unfiled" | string;

export interface FormListContext {
  folder: FormFolderSelection;
  origin: FormOrigin;
}

type SearchParamsReader = Pick<URLSearchParams, "get">;

export function readFormListContext(searchParams: SearchParamsReader): FormListContext {
  const folder = searchParams.get("folder")?.trim() || "root";
  const origin = searchParams.get("origin") === "nps" ? "nps" : "standard";
  return { folder, origin };
}

export function withFormListContext(pathname: string, context: FormListContext): string {
  const params = new URLSearchParams();
  if (context.folder !== "root") params.set("folder", context.folder);
  if (context.origin !== "standard") params.set("origin", context.origin);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function preserveFormListContext(pathname: string, searchParams: SearchParamsReader): string {
  return withFormListContext(pathname, readFormListContext(searchParams));
}
