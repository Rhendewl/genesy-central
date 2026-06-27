export interface SecretProvider {
  resolve(encrypted: Record<string, string>): Promise<Record<string, string>>;
}

/** Development / test adapter — returns secrets as-is. Never use in production. */
export class PlainSecretProvider implements SecretProvider {
  async resolve(secrets: Record<string, string>): Promise<Record<string, string>> {
    return { ...secrets };
  }
}

/**
 * Resolves environment variable references.
 * Any value starting with "$" is treated as an env var name.
 * Example: { access_token: "$META_TOKEN" } → process.env.META_TOKEN
 */
export class EnvSecretProvider implements SecretProvider {
  async resolve(encrypted: Record<string, string>): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(encrypted)) {
      if (value.startsWith("$")) {
        const envKey = value.slice(1);
        result[key]  = process.env[envKey] ?? "";
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
