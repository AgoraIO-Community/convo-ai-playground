const SENSITIVE_KEYS = new Set([
  "authorization",
  "api_key",
  "api_subscription_key",
  "access_key",
  "secret_key",
  "key",
  "password",
  "token",
  "agora_token",
  "customer_secret",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("_secret");
}

function maskSensitiveUrl(value: string): string {
  try {
    const url = new URL(value);
    let changed = false;
    for (const key of ["key", "api_key", "access_token", "token"]) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, "***MASKED***");
        changed = true;
      }
    }
    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}

export function maskSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item)) as T;
  }
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveKey(key)
        ? "***MASKED***"
        : key.toLowerCase() === "url" && typeof child === "string"
          ? maskSensitiveUrl(child)
          : maskSensitive(child),
    ]),
  ) as T;
}
