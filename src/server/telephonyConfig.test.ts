import { describe, expect, it } from "vitest";
import {
  buildTelephonyAuthorization,
  readTelephonyConfig,
} from "./telephonyConfig";

const validEnv: NodeJS.ProcessEnv = {
  AGENT_STUDIO_V2_BASE_URL: "https://api.agora.io/conversational-ai",
  AGORA_TELEPHONY_PHONE_NUMBER_ID: "851",
  NEXT_PUBLIC_AGORA_APP_ID: "app-id",
  AGORA_CUSTOMER_ID: "customer",
  AGORA_CUSTOMER_SECRET: "secret",
};

describe("readTelephonyConfig", () => {
  it("parses the verified gateway and phone-number ID", () => {
    expect(readTelephonyConfig(validEnv)).toMatchObject({
      baseUrl: "https://api.agora.io/conversational-ai",
      phoneNumberId: 851,
      appId: "app-id",
    });
  });

  it("rejects a missing phone-number ID", () => {
    expect(() =>
      readTelephonyConfig({
        ...validEnv,
        AGORA_TELEPHONY_PHONE_NUMBER_ID: "",
      }),
    ).toThrow("AGORA_TELEPHONY_PHONE_NUMBER_ID");
  });

  it("rejects a non-HTTPS gateway", () => {
    expect(() =>
      readTelephonyConfig({
        ...validEnv,
        AGENT_STUDIO_V2_BASE_URL: "http://api.agora.io/conversational-ai",
      }),
    ).toThrow("must use HTTPS");
  });

  it("builds Basic Auth from customer credentials", () => {
    const config = readTelephonyConfig(validEnv);
    expect(buildTelephonyAuthorization(config)).toBe(
      `Basic ${Buffer.from("customer:secret").toString("base64")}`,
    );
  });
});
