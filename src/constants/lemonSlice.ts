export const LEMON_SLICE_DEFAULT_API_BASE_URL =
  "https://lemonslice.com/api/liveai/agora";

export const LEMON_SLICE_DEFAULT_AVATAR_ID =
  "https://lemonslice.com/flash-test.jpg";

export const LEMON_SLICE_DEFAULT_QUALITY = "high" as const;
export const LEMON_SLICE_DEFAULT_AREA = "NORTH_AMERICA";

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
