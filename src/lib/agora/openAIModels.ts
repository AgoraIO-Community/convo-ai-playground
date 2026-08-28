export const OPENAI_MANAGED_MODEL_IDS = [
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "gpt-5-nano",
  "gpt-5-mini",
] as const;

export const OPENAI_BYOK_MODEL_IDS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
] as const;

export const OPENAI_MANAGED_DEFAULT_MODEL = "gpt-5-mini";
export const OPENAI_BYOK_DEFAULT_MODEL = "gpt-5.6-terra";
export const OPENAI_CUSTOM_MODEL_VALUE = "__custom_openai_model__";

export function isCuratedOpenAIByokModel(model: string): boolean {
  return OPENAI_BYOK_MODEL_IDS.some((candidate) => candidate === model);
}

export function getOpenAIModelControlValue(model: string): string {
  return isCuratedOpenAIByokModel(model)
    ? model
    : OPENAI_CUSTOM_MODEL_VALUE;
}

export function resolveOpenAIModelValue(
  selectedValue: string,
  customValue: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (selectedValue !== OPENAI_CUSTOM_MODEL_VALUE) {
    return { ok: true, value: selectedValue };
  }

  const value = customValue.trim();
  return value
    ? { ok: true, value }
    : { ok: false, error: "Enter a custom OpenAI model ID." };
}
