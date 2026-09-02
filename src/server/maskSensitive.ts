const SENSITIVE_KEYS = new Set([
  "authorization",
  "api_key",
  "api_subscription_key",
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

export function maskSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item)) as T;
  }
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      isSensitiveKey(key) ? "***MASKED***" : maskSensitive(child),
    ]),
  ) as T;
}
