import { describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import {
  AI_TEACHER_GREETING,
  AI_TEACHER_SYSTEM_PROMPT,
  getAiTeacherLearnerName,
  withAiTeacherRuntimeDefaults,
} from "./aiTeacherDefaults";

function createSettings(): AgentSettings {
  return {
    name: "teacher",
    llm: {
      credential_mode: "byok",
      vendor: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      api_key: "test-key",
      params: { model: "gpt-4o-mini" },
    },
    tts: {
      credential_mode: "byok",
      vendor: "openai",
      params: { key: "test-key", model: "tts-1", voice: "alloy" },
    },
    avatar: {
      enable: true,
      vendor: "lemonslice",
      params: {
        api_key: "test-key",
        avatar_id: "lemonslice",
        agent_image_url: "https://example.com/teacher.jpg",
        aspect_ratio: "1x1",
        agora_uid: "100",
        api_base_url: "https://api.lemonslice.com",
      },
    },
  };
}

describe("withAiTeacherRuntimeDefaults", () => {
  it.each([undefined, "managed"] as const)("uses explicit BYOK ASR instead of stale credential mode %s", (credentialMode) => {
    const settings = createSettings();
    settings.asr = { vendor: "deepgram", credential_mode: credentialMode, params: { api_key: "", model: "nova-2" } };
    const result = withAiTeacherRuntimeDefaults(settings, "pt-BR");
    expect(result.asr).toMatchObject({
      vendor: "deepgram", credential_mode: "byok", language: "pt-BR",
      params: { model: "nova-3", language: "pt-BR" },
    });
    expect(settings.asr.credential_mode).toBe(credentialMode);
  });
  it("applies Brazilian Portuguese at runtime without mutating saved providers", () => {
    const settings = createSettings();
    settings.asr = { vendor: "microsoft", language: "en-US", params: { region: "westus", key: "azure-key" } };
    const result = withAiTeacherRuntimeDefaults(settings, "pt-BR");
    expect(result.asr).toMatchObject({ vendor: "deepgram", language: "pt-BR", params: { model: "nova-3", language: "pt-BR" } });
    expect(result.asr?.params).not.toHaveProperty("region");
    expect(result.asr?.params).not.toHaveProperty("key");
    expect(result.llm.greeting_message).toContain("sua professora");
    expect(result.llm.system_messages?.[0].content).toContain("Brazilian Portuguese");
    expect(result.tts).toEqual(settings.tts);
    expect(settings.asr.vendor).toBe("microsoft");
  });
  it("uses English ASR and greeting after selection and preserves Deepgram credentials", () => {
    const settings = createSettings();
    settings.asr = { vendor: "deepgram", params: { key: "dg-key", model: "nova-2", language: "fr" } };
    const result = withAiTeacherRuntimeDefaults(settings, "en-US");
    expect(result.asr).toMatchObject({ language: "en-US", params: { key: "dg-key", model: "nova-3", language: "en-US" } });
    expect(result.llm.greeting_message).toContain("I'm Samira");
  });
  it("introduces the visual teacher as Samira", () => {
    expect(AI_TEACHER_SYSTEM_PROMPT).toContain("You are Samira");
    expect(AI_TEACHER_GREETING).toContain("I'm Samira");
  });

  it("uses a portrait LemonSlice canvas so the teacher is not cropped", () => {
    const result = withAiTeacherRuntimeDefaults(createSettings());

    expect(result.avatar?.params).toMatchObject({ aspect_ratio: "2x3" });
  });
});

describe("getAiTeacherLearnerName", () => {
  it("uses only the learner's first name in the teacher greeting", () => {
    expect(getAiTeacherLearnerName("  Bhupendra   Negi ")).toBe("Bhupendra");
  });
});
