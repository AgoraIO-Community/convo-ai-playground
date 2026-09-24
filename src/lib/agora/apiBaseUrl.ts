export const DEFAULT_AGORA_API_BASE_URL =
  "https://api.agora.io/api/conversational-ai-agent/v2";

export const GEMINI_PREVIEW_API_BASE_URL =
  "https://partner.ai.agora.io/preview/api/conversational-ai-agent/v2";

export function normalizeAgoraApiBaseUrl(value?: string): string {
  const candidate = value?.trim() || DEFAULT_AGORA_API_BASE_URL;
  const parsed = new URL(candidate);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Agora API base URL must use HTTP or HTTPS.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("Agora API base URL cannot include a query or fragment.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

export function buildAgoraProjectApiUrl(
  baseUrl: string | undefined,
  appId: string,
  path: string,
): string {
  const normalizedBaseUrl = normalizeAgoraApiBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}/projects/${encodeURIComponent(appId)}${normalizedPath}`;
}
