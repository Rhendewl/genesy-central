export interface AdministrativeMember {
  role?: string | null;
  job_title?: string | null;
}

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function isAdministrativeMember(
  member: AdministrativeMember | null | undefined,
  isOwner = false,
) {
  return isOwner || member?.role === "admin" || normalize(member?.job_title) === "socio";
}
