import { describe, expect, it } from "vitest";
import { newestPostProject } from "@/lib/marketing/post-project-sync";

describe("post generator project synchronization", () => {
  it("uses the remote project when it is newer", () => {
    const local = { updatedAt: 10, value: "pwa" };
    const remote = { updatedAt: 20, value: "browser" };
    expect(newestPostProject(local, remote)).toBe(remote);
  });

  it("uses and migrates the local project when the server has no copy", () => {
    const local = { updatedAt: 10, value: "existing-pwa-project" };
    expect(newestPostProject(local, undefined)).toBe(local);
  });

  it("does not overwrite a newer local edit with an older remote copy", () => {
    const local = { updatedAt: 30, value: "latest-local-edit" };
    const remote = { updatedAt: 20, value: "stale-server-copy" };
    expect(newestPostProject(local, remote)).toBe(local);
  });

  it("preserves a meaningful PWA project when a newer browser copy is untouched", () => {
    const pwa = {
      updatedAt: 10,
      slides: [{ media: ["data:image/png;base64,content"], textBlocks: [{ content: "<p>Texto editado</p>" }] }],
    };
    const untouchedBrowser = {
      updatedAt: 50,
      slides: [{ media: [], textBlocks: [{ content: "<p>Uma boa história começa com uma frase que prende.</p>" }] }],
    };
    expect(newestPostProject(pwa, untouchedBrowser)).toBe(pwa);
    expect(newestPostProject(untouchedBrowser, pwa)).toBe(pwa);
  });
});
