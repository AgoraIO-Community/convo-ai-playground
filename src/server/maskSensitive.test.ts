import { describe, expect, it } from "vitest";
import { maskSensitive } from "./maskSensitive";

describe("maskSensitive", () => {
  it("recursively masks credentials without mutating the source", () => {
    const source = {
      Authorization: "Basic secret",
      token: "rtc-token",
      llm: { api_key: "llm-key" },
      asr: { params: { key: "asr-key", api_key: "asr-api-key" } },
      nested: [{ password: "password", customer_secret: "customer-secret" }],
      public: "visible",
    };

    expect(maskSensitive(source)).toEqual({
      Authorization: "***MASKED***",
      token: "***MASKED***",
      llm: { api_key: "***MASKED***" },
      asr: {
        params: { key: "***MASKED***", api_key: "***MASKED***" },
      },
      nested: [
        { password: "***MASKED***", customer_secret: "***MASKED***" },
      ],
      public: "visible",
    });
    expect(source.llm.api_key).toBe("llm-key");
  });
});
