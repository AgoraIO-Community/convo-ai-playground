import { describe, expect, it } from "vitest";
import type { AgentSettings } from "@/types/agora";
import {
  getTranscriptTransport,
  withCustomPayloadTranscriptTransport,
  withTranscriptTransport,
} from "./transcriptTransport";

const baseSettings = {
  name: "agent",
  advanced_features: {},
  parameters: {},
} as AgentSettings;

describe("transcript transport", () => {
  it("normalizes disabled RTM to the RTC data channel", () => {
    const settings = withTranscriptTransport({
      ...baseSettings,
      advanced_features: { enable_rtm: false },
    });

    expect(getTranscriptTransport(settings)).toBe("rtc");
    expect(settings).toMatchObject({
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "rtc" },
    });
  });

  it("normalizes enabled RTM to the RTM data channel", () => {
    const settings = withTranscriptTransport({
      ...baseSettings,
      advanced_features: { enable_rtm: true },
    });

    expect(getTranscriptTransport(settings)).toBe("rtm");
    expect(settings).toMatchObject({
      advanced_features: { enable_rtm: true },
      parameters: { data_channel: "rtm" },
    });
  });

  it("uses the regular setting when a custom payload omits enable_rtm", () => {
    const payload = withCustomPayloadTranscriptTransport(
      { name: "custom", properties: {} },
      "rtc",
    );

    expect(payload.properties).toMatchObject({
      advanced_features: { enable_rtm: false },
      parameters: { data_channel: "rtc" },
    });
  });

  it("honors an explicit custom RTM preference", () => {
    const payload = withCustomPayloadTranscriptTransport(
      {
        name: "custom",
        properties: { advanced_features: { enable_rtm: true } },
      },
      "rtc",
    );

    expect(payload.properties).toMatchObject({
      advanced_features: { enable_rtm: true },
      parameters: { data_channel: "rtm" },
    });
  });
});
