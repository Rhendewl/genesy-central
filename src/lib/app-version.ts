export const DEVELOPMENT_APP_VERSION = "development";

export function normalizeAppVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const version = value.trim();
  return version.length > 0 && version.length <= 200 ? version : null;
}

export function hasNewAppVersion(currentVersion: string, latestVersion: unknown): latestVersion is string {
  const current = normalizeAppVersion(currentVersion);
  const latest = normalizeAppVersion(latestVersion);
  if (!current || !latest) return false;
  if (current === DEVELOPMENT_APP_VERSION || latest === DEVELOPMENT_APP_VERSION) return false;
  return current !== latest;
}
