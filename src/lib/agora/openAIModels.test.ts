import { describe, expect, it } from "vitest";
import {
  OPENAI_BYOK_MODEL_IDS,
  OPENAI_CUSTOM_MODEL_VALUE,
  OPENAI_MANAGED_MODEL_IDS,
  getOpenAIModelControlValue,
  resolveOpenAIModelValue,
} from "./openAIModels";

describe("OpenAI model choices", () => {
  it("limits Agora-managed credentials to the documented models", () => {
    expect(OPENAI_MANAGED_MODEL_IDS).toEqual([
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-5-nano",
      "gpt-5-mini",
    ]);
  });

  it("offers supported conversational BYOK models without unrelated families", () => {
    expect(OPENAI_BYOK_MODEL_IDS).toEqual(
      expect.arrayContaining([
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
        "gpt-5.5",
        "gpt-5.4-mini",
        "gpt-4.1-mini",
        "gpt-4o-mini",
      ]),
    );
    expect(OPENAI_BYOK_MODEL_IDS).not.toEqual(
      expect.arrayContaining([
        "gpt-realtime",
        "gpt-image-1",
        "gpt-4o-transcribe",
        "codex-mini-latest",
        "gpt-3.5-turbo",
      ]),
    );
  });

  it("round-trips an unknown stored model through the custom choice", () => {
    expect(getOpenAIModelControlValue("gpt-5.7-preview")).toBe(
      OPENAI_CUSTOM_MODEL_VALUE,
    );
    expect(
      resolveOpenAIModelValue(OPENAI_CUSTOM_MODEL_VALUE, "  gpt-5.7-preview  "),
    ).toEqual({ ok: true, value: "gpt-5.7-preview" });
  });

  it("rejects an empty custom model ID", () => {
    expect(resolveOpenAIModelValue(OPENAI_CUSTOM_MODEL_VALUE, " ")).toEqual({
      ok: false,
      error: "Enter a custom OpenAI model ID.",
    });
  });
});
