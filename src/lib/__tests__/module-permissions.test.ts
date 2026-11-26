import { describe, expect, it } from "vitest";
import {
  INSTAGRAM_OWN_ACCOUNTS_PERMISSION,
  allSubmoduleKeys,
  canAccess,
  expandLegacyPermissions,
  firstMarketingHome,
  hasPermissionKey,
  isInstagramOwnScoped,
  marketingPermissionForPath,
  normalizePermissions,
  topLevelPermissions,
} from "@/lib/module-permissions";

describe("hasPermissionKey", () => {
  it("keeps legacy members with only the module key fully unrestricted", () => {
    const perms = ["dashboard", "marketing"];
    expect(hasPermissionKey(perms, "marketing")).toBe(true);
    expect(hasPermissionKey(perms, "marketing.concorrentes")).toBe(true);
    expect(hasPermissionKey(perms, "marketing.instagram.automations")).toBe(true);
  });

  it("restricts siblings once one submodule is explicit", () => {
    const perms = ["marketing", "marketing.instagram"];
    expect(hasPermissionKey(perms, "marketing.instagram")).toBe(true);
    expect(hasPermissionKey(perms, "marketing.concorrentes")).toBe(false);
    expect(hasPermissionKey(perms, "marketing.instagram.posts")).toBe(true);
  });

  it("restricts tabs inside a submodule", () => {
    const perms = ["marketing", "marketing.instagram", "marketing.instagram.automations"];
    expect(hasPermissionKey(perms, "marketing.instagram.automations")).toBe(true);
    expect(hasPermissionKey(perms, "marketing.instagram.reports")).toBe(false);
  });

  it("requires the parent module", () => {
    expect(hasPermissionKey(["marketing.instagram"], "marketing.instagram")).toBe(false);
    expect(hasPermissionKey([], "marketing")).toBe(false);
  });

  it("does not treat the own-accounts scope as a submodule restriction", () => {
    const perms = ["marketing", INSTAGRAM_OWN_ACCOUNTS_PERMISSION];
    expect(hasPermissionKey(perms, "marketing.concorrentes")).toBe(true);
    expect(hasPermissionKey(perms, "marketing.instagram.reports")).toBe(true);
  });

  it("lets admins through", () => {
    expect(canAccess([], "marketing.instagram.automations", true)).toBe(true);
    expect(isInstagramOwnScoped([INSTAGRAM_OWN_ACCOUNTS_PERMISSION], true)).toBe(false);
    expect(isInstagramOwnScoped([INSTAGRAM_OWN_ACCOUNTS_PERMISSION], false)).toBe(true);
  });
});

describe("editor helpers", () => {
  it("expands legacy permissions into explicit checkboxes", () => {
    const expanded = expandLegacyPermissions(["marketing"]);
    for (const key of allSubmoduleKeys("marketing")) expect(expanded).toContain(key);
  });

  it("keeps explicit restrictions when expanding", () => {
    const expanded = expandLegacyPermissions(["marketing", "marketing.instagram"]);
    expect(expanded).toContain("marketing.instagram.automations");
    expect(expanded).not.toContain("marketing.concorrentes");
  });

  it("does not expand modules the member lacks", () => {
    expect(expandLegacyPermissions(["crm"])).toEqual(["crm"]);
  });

  it("drops orphan submodule keys and scopes", () => {
    expect(normalizePermissions(["crm", "marketing.instagram", "marketing.instagram.posts", INSTAGRAM_OWN_ACCOUNTS_PERMISSION]))
      .toEqual(["crm"]);
    expect(normalizePermissions(["marketing", "marketing.instagram", INSTAGRAM_OWN_ACCOUNTS_PERMISSION]))
      .toEqual(["marketing", "marketing.instagram", INSTAGRAM_OWN_ACCOUNTS_PERMISSION]);
  });

  it("counts only top-level modules", () => {
    expect(topLevelPermissions(["marketing", "marketing.instagram", INSTAGRAM_OWN_ACCOUNTS_PERMISSION, "crm"]))
      .toEqual(["marketing", "crm"]);
  });
});

describe("marketing routes", () => {
  it("maps pages to submodules", () => {
    expect(marketingPermissionForPath("/marketing/relatorios")).toBe("marketing.instagram");
    expect(marketingPermissionForPath("/marketing/automacoes")).toBe("marketing.instagram.automations");
    expect(marketingPermissionForPath("/marketing/trafego")).toBe("marketing.trafego");
    expect(marketingPermissionForPath("/marketing")).toBeNull();
    expect(marketingPermissionForPath("/marketing/relatoriosx")).toBeNull();
  });

  it("finds the first allowed home", () => {
    expect(firstMarketingHome(["marketing"], false)).toBe("/marketing/relatorios");
    expect(firstMarketingHome(["marketing", "marketing.gerador"], false)).toBe("/marketing/gerador");
    expect(firstMarketingHome([], true)).toBe("/marketing/relatorios");
  });
});
