import { describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import {
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
      },
    },
  };
}

describe("withAiTeacherRuntimeDefaults", () => {
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
