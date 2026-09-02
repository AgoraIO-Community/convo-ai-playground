export const DEFAULT_BEDROCK_REGION = "us-east-1";
export const DEFAULT_BEDROCK_MODEL =
  "us.anthropic.claude-sonnet-4-20250514-v1:0";
export const DEFAULT_VERTEX_LOCATION = "us-central1";
export const DEFAULT_VERTEX_MODEL = "gemini-2.0-flash-001";

export function buildGeminiUrl(model: string): string {
  const normalizedModel = model.trim();
  if (!normalizedModel) return "";
  return `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:streamGenerateContent?alt=sse`;
}

export function appendGeminiApiKey(url: string, apiKey: string): string {
  const normalizedUrl = url.trim();
  const normalizedApiKey = apiKey.trim();
  if (!normalizedUrl || !normalizedApiKey) return normalizedUrl;

  const parsedUrl = new URL(normalizedUrl);
  parsedUrl.searchParams.set("key", normalizedApiKey);
  return parsedUrl.toString();
}

export function buildBedrockUrl(region: string, model: string): string {
  const normalizedRegion = region.trim();
  const normalizedModel = model.trim();
  if (!normalizedRegion || !normalizedModel) return "";
  return `https://bedrock-runtime.${normalizedRegion}.amazonaws.com/model/${normalizedModel}/converse-stream`;
}

export function buildVertexUrl(
  projectId: string,
  location: string,
  model: string,
): string {
  const normalizedProject = projectId.trim();
  const normalizedLocation = location.trim();
  const normalizedModel = model.trim();
  if (!normalizedProject || !normalizedLocation || !normalizedModel) return "";
  return `https://${normalizedLocation}-aiplatform.googleapis.com/v1/projects/${normalizedProject}/locations/${normalizedLocation}/publishers/google/models/${normalizedModel}:streamGenerateContent?alt=sse`;
}
