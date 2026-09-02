import { describe, expect, it } from "vitest";
import { maskSensitive } from "./maskSensitive";

describe("maskSensitive", () => {
  it("recursively masks credentials without mutating the source", () => {
    const source = {
      Authorization: "Basic secret",
      token: "rtc-token",
      llm: {
        api_key: "llm-key",
        access_key: "aws-access-key",
        secret_key: "aws-secret-key",
      },
      tts: { params: { api_subscription_key: "sarvam-key" } },
      asr: { params: { key: "asr-key", api_key: "asr-api-key" } },
      nested: [{ password: "password", customer_secret: "customer-secret" }],
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=gemini-secret",
      public: "visible",
    };

    expect(maskSensitive(source)).toEqual({
      Authorization: "***MASKED***",
      token: "***MASKED***",
      llm: {
        api_key: "***MASKED***",
        access_key: "***MASKED***",
        secret_key: "***MASKED***",
      },
      tts: { params: { api_subscription_key: "***MASKED***" } },
      asr: {
        params: { key: "***MASKED***", api_key: "***MASKED***" },
      },
      nested: [
        { password: "***MASKED***", customer_secret: "***MASKED***" },
      ],
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=***MASKED***",
      public: "visible",
    });
    expect(source.llm.api_key).toBe("llm-key");
  });
});
