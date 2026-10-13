// @vitest-environment node
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
function configuredVersion(env: Record<string, string>) {
  return execFileSync(process.execPath, ["--input-type=module", "-e", "import c from './next.config.mjs'; console.log(c.env.NEXT_PUBLIC_APP_VERSION)"], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, VERCEL_GIT_COMMIT_SHA: "", VERCEL_DEPLOYMENT_ID: "", VERCEL_URL: "", ...env },
  }).trim();
}
describe("build version configuration", () => {
  it("ignores the empty Git SHA seen in production and uses the deployment identifier", () => {
    expect(configuredVersion({ VERCEL_DEPLOYMENT_ID: "dpl_123" })).toBe("dpl_123");
    expect(configuredVersion({ VERCEL_URL: "project-new.vercel.app" })).toBe("project-new.vercel.app");
  });
  it("has a valid version for production builds without Vercel metadata", () => {
    expect(configuredVersion({ NODE_ENV: "production" })).toMatch(/^[\da-f-]{36}$/);
  });
  it("keeps local development notifications disabled", () => {
    expect(configuredVersion({ NODE_ENV: "development" })).toBe("development");
  });
});
