export const LEMON_SLICE_DEFAULT_API_BASE_URL =
  "https://lemonslice.com/api/liveai/agora";

export const LEMON_SLICE_AVATAR_ID = "lemonslice" as const;

export const LEMON_SLICE_DEFAULT_AGENT_IMAGE_URL =
  "https://lemonslice.com/flash-test.jpg";

/** Legacy alias for deployments that stored the image URL as avatar_id. */
export const LEMON_SLICE_DEFAULT_AVATAR_ID =
  LEMON_SLICE_DEFAULT_AGENT_IMAGE_URL;

export const LEMON_SLICE_DEFAULT_QUALITY = "high" as const;
export const LEMON_SLICE_DEFAULT_AREA = "NORTH_AMERICA";

export const LEMON_SLICE_MODEL_OPTIONS = [
  { value: "", label: "Default (flagship)" },
  { value: "lite", label: "Lite" },
  { value: "flash", label: "Flash" },
  { value: "pro", label: "Pro" },
  { value: "cwm-1", label: "CWM-1" },
] as const;

export const LEMON_SLICE_ASPECT_RATIO_OPTIONS = [
  { value: "1x1", label: "1:1 (square)" },
  { value: "2x3", label: "2:3 (portrait)" },
  { value: "9x16", label: "9:16 (vertical)" },
] as const;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
