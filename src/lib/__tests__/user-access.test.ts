import { describe, expect, it } from "vitest";
import { isAdministrativeMember } from "@/lib/user-access";

describe("isAdministrativeMember", () => {
  it("permite o dono da conta", () => {
    expect(isAdministrativeMember({ role: "viewer" }, true)).toBe(true);
  });

  it("permite administradores", () => {
    expect(isAdministrativeMember({ role: "admin" })).toBe(true);
  });

  it("reconhece sócio independentemente de acento e caixa", () => {
    expect(isAdministrativeMember({ role: "viewer", job_title: " SÓCIO " })).toBe(true);
    expect(isAdministrativeMember({ role: "viewer", job_title: "Socio" })).toBe(true);
  });

  it("restringe os demais colaboradores", () => {
    expect(isAdministrativeMember({ role: "comercial", job_title: "SDR" })).toBe(false);
    expect(isAdministrativeMember(null)).toBe(false);
  });
});
