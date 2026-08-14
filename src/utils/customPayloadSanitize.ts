/**
 * Sanitize custom agent join payload: allowlist keys per Agora join API, strip dangerous strings.
 * Never pass unsanitized user JSON to the server.
 */

const DANGEROUS_PATTERNS = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /vbscript:/i,
  /data:\s*text\/html/i,
];

function isDangerousString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const s = value;
  return DANGEROUS_PATTERNS.some((re) => re.test(s));
}

/** Top-level keys allowed in join payload.properties (Agora join API). */
const ALLOWED_PROPERTY_KEYS = new Set([
  "channel",
  "token",
  "agent_rtc_uid",
  "remote_rtc_uids",
  "enable_string_uid",
  "idle_timeout",
  "llm",
  "tts",
  "asr",
  "turn_detection",
  "advanced_features",
  "parameters",
  "avatar",
  "geofence",
  "labels",
  "rtc",
  "filler_words",
  "mllm",
  "sal",
]);

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (isDangerousString(value)) return "";
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const sanitized = sanitizeValue(v);
      if (sanitized !== undefined) out[k] = sanitized;
    }
    return out;
  }
  return undefined;
}

/**
 * Sanitize a parsed join payload (name + properties).
 * - Only allow known top-level keys in properties.
 * - Recursively sanitize values (strip dangerous strings).
 * - Return null if invalid or missing required shape.
 */
export function sanitizeCustomJoinPayload(
  parsed: unknown,
): { name: string; properties: Record<string, unknown> } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const properties = obj.properties;
  if (!name || !properties || typeof properties !== "object") return null;

  const allowedProps: Record<string, unknown> = {};
  const props = properties as Record<string, unknown>;
  for (const key of Object.keys(props)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) continue;
    const sanitized = sanitizeValue(props[key]);
    if (sanitized !== undefined) allowedProps[key] = sanitized;
  }

  stripV25DeprecatedJoinFields(allowedProps);

  return { name, properties: allowedProps };
}

/** v2.5 removed these fields from Start agent; strip if present in custom JSON. */
function stripV25DeprecatedJoinFields(p: Record<string, unknown>): void {
  delete p.silence_timeout;
  const llm = p.llm;
  if (llm && typeof llm === "object" && llm !== null) {
    delete (llm as Record<string, unknown>).silence_message;
  }
  const adv = p.advanced_features;
  if (adv && typeof adv === "object" && adv !== null) {
    delete (adv as Record<string, unknown>).enable_aivad;
  }
}
