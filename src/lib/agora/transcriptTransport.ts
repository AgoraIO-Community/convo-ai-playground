import type { AgentSettings } from "@/types/agora";

export type TranscriptTransport = "rtc" | "rtm";

export interface CustomJoinPayload {
  name: string;
  properties: Record<string, unknown>;
}

export function getTranscriptTransport(
  settings: Pick<AgentSettings, "advanced_features">,
): TranscriptTransport {
  return settings.advanced_features?.enable_rtm === false ? "rtc" : "rtm";
}

export function withTranscriptTransport(
  settings: AgentSettings,
): AgentSettings {
  const transport = getTranscriptTransport(settings);
  return {
    ...settings,
    advanced_features: {
      ...settings.advanced_features,
      enable_rtm: transport === "rtm",
    },
    parameters: {
      ...settings.parameters,
      data_channel: transport,
    },
  };
}

export function withCustomPayloadTranscriptTransport(
  payload: CustomJoinPayload,
  fallback: TranscriptTransport,
): CustomJoinPayload {
  const advancedFeatures =
    typeof payload.properties.advanced_features === "object" &&
    payload.properties.advanced_features !== null
      ? (payload.properties.advanced_features as Record<string, unknown>)
      : {};
  const parameters =
    typeof payload.properties.parameters === "object" &&
    payload.properties.parameters !== null
      ? (payload.properties.parameters as Record<string, unknown>)
      : {};
  const enableRtm =
    typeof advancedFeatures.enable_rtm === "boolean"
      ? advancedFeatures.enable_rtm
      : fallback === "rtm";

  return {
    ...payload,
    properties: {
      ...payload.properties,
      advanced_features: {
        ...advancedFeatures,
        enable_rtm: enableRtm,
      },
      parameters: {
        ...parameters,
        data_channel: enableRtm ? "rtm" : "rtc",
      },
    },
  };
}
