import { NextRequest, NextResponse } from "next/server";
import { RtcTokenBuilder, RtcRole } from "agora-token";
import type {
  AgentSettings,
  TurnDetectionConfig,
  FillerWordsConfig,
  SalConfig,
  MllmConfig,
} from "@/types/agora";
import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";
import {
  buildMllmInvitePayload,
  getMllmApiKeyEnvName,
} from "@/utils/mllmEnv";

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE!;
const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID!;
const CUSTOMER_SECRET = process.env.AGORA_CUSTOMER_SECRET!;

function shouldInjectServerKey(v: string | undefined): boolean {
  return (
    !v || v.trim() === "" || v === "__USE_SERVER__" || v === "***MASKED***"
  );
}

/** Agora v2.5: stored UI vendor `heygen` maps to join API `liveavatar`. */
function agoraAvatarVendorForApi(vendor: string | undefined): string {
  if (!vendor || vendor === "heygen") return "liveavatar";
  return vendor;
}

function isLiveAvatarVendor(vendor: string | undefined): boolean {
  return vendor === "heygen" || vendor === "liveavatar";
}

async function handleCustomPayloadJoin(
  channelName: string,
  uid: string,
  customJoinPayload: { name: string; properties: Record<string, unknown> },
  username?: string,
): Promise<NextResponse> {
  const agentUid = 0;
  const tokenExpiration = 3600;
  const privilegeExpiration = 3600;
  const agentRtcToken = RtcTokenBuilder.buildTokenWithRtm(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    String(agentUid),
    RtcRole.PUBLISHER,
    tokenExpiration,
    privilegeExpiration,
  );

  const properties = { ...customJoinPayload.properties } as Record<
    string,
    unknown
  >;
  properties.channel = channelName;
  properties.token = agentRtcToken;
  properties.agent_rtc_uid = String(agentUid);
  properties.remote_rtc_uids = [String(uid)];

  const llm = properties.llm as Record<string, unknown> | undefined;
  // Inject template_variables.username for greeting (e.g. "Hello {{username}}")
  if (llm && username != null && username.trim() !== "") {
    const existing =
      (typeof llm.template_variables === "object" && llm.template_variables != null
        ? llm.template_variables
        : {}) as Record<string, unknown>;
    llm.template_variables = { ...existing, username: username.trim() };
  }
  if (llm && shouldInjectServerKey(llm.api_key as string)) {
    llm.api_key = (
      process.env.LLM_API_KEY ||
      process.env.NEXT_PUBLIC_LLM_API_KEY ||
      ""
    ).trim();
  }

  const tts = properties.tts as Record<string, unknown> | undefined;
  if (tts?.params && typeof tts.params === "object") {
    const p = tts.params as Record<string, unknown>;
    if (shouldInjectServerKey(p.key as string)) {
      const vendor = (tts.vendor ?? "microsoft") as string;
      if (vendor === "elevenlabs")
        p.key = (
          process.env.ELEVENLABS_API_KEY ||
          process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ||
          ""
        ).trim();
      else if (vendor === "openai")
        p.key = (
          process.env.OPENAI_TTS_KEY ||
          process.env.NEXT_PUBLIC_OPENAI_TTS_KEY ||
          ""
        ).trim();
      else if (vendor === "deepgram")
        p.key = (
          process.env.DEEPGRAM_TTS_KEY ||
          process.env.DEEPGRAM_API_KEY ||
          process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ||
          ""
        ).trim();
      else
        p.key = (
          process.env.MICROSOFT_TTS_KEY ||
          process.env.NEXT_PUBLIC_MICROSOFT_TTS_KEY ||
          ""
        ).trim();
    }
    const ttsVendorCustom = (tts.vendor ?? "microsoft") as string;
    if (ttsVendorCustom === "elevenlabs") {
      const vid = String((p.voice_id as string) ?? "").trim();
      if (!vid) {
        p.voice_id =
          (process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "").trim() ||
          ELEVENLABS_DEFAULT_VOICE_ID;
      }
    }
  }

  const asr = properties.asr as Record<string, unknown> | undefined;
  if (asr?.params && typeof asr.params === "object") {
    const p = asr.params as Record<string, unknown>;
    const keyVal = (p.api_key as string) ?? (p.key as string) ?? "";
    if (shouldInjectServerKey(keyVal)) {
      const vendor = (asr.vendor ?? "ares") as string;
      if (vendor === "deepgram")
        p.api_key = (
          process.env.DEEPGRAM_API_KEY ||
          process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ||
          ""
        ).trim();
      else if (vendor === "microsoft")
        p.key = (
          process.env.MICROSOFT_ASR_KEY ||
          process.env.NEXT_PUBLIC_MICROSOFT_ASR_KEY ||
          ""
        ).trim();
    }
  }

  let avatarRtcUidReturn: string | null = null;
  const avatar = properties.avatar as Record<string, unknown> | undefined;
  if (avatar?.enable && avatar?.params && typeof avatar.params === "object") {
    const params = avatar.params as Record<string, unknown>;
    const vendor = (avatar.vendor ?? "heygen") as string;
    if (vendor === "heygen" || vendor === "liveavatar") {
      if (shouldInjectServerKey(params.api_key as string)) {
        params.api_key = (
          process.env.HEYGEN_API_KEY ||
          process.env.NEXT_PUBLIC_HEYGEN_API_KEY ||
          ""
        ).trim();
      }
      avatarRtcUidReturn = "999999";
      const avatarUid = 999999;
      params.agora_uid = String(avatarUid);
      params.agora_token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        avatarUid,
        RtcRole.PUBLISHER,
        tokenExpiration,
        privilegeExpiration,
      );
    } else if (vendor === "akool") {
      if (shouldInjectServerKey(params.api_key as string)) {
        params.api_key = (
          process.env.AKOOL_API_KEY ||
          process.env.NEXT_PUBLIC_AKOOL_API_KEY ||
          ""
        ).trim();
      }
      avatarRtcUidReturn = "999999";
      const avatarUid = 999999;
      params.agora_uid = String(avatarUid);
      params.agora_token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        avatarUid,
        RtcRole.PUBLISHER,
        tokenExpiration,
        privilegeExpiration,
      );
    } else if (vendor === "anam") {
      const keyToInject =
        (params.api_key as string) ?? (params.anam_api_key as string);
      if (shouldInjectServerKey(keyToInject)) {
        const injected = (
          process.env.ANAM_API_KEY ||
          process.env.NEXT_PUBLIC_ANAM_API_KEY ||
          ""
        ).trim();
        params.api_key = injected;
      }
      const avatarId =
        (params.anam_avatar_id as string) ??
        (params.avatar_id as string) ??
        "";
      params.avatar_id = String(avatarId).trim();
      if (params.sample_rate == null) params.sample_rate = 24000;
      if (!params.quality) params.quality = "high";
      if (!params.video_encoding) params.video_encoding = "H264";
      delete params.anam_api_key;
      delete params.anam_avatar_id;
      delete params.anam_base_url;
      avatarRtcUidReturn = "999999";
      const avatarUid = 999999;
      params.agora_uid = String(avatarUid);
      params.agora_token = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        avatarUid,
        RtcRole.PUBLISHER,
        tokenExpiration,
        privilegeExpiration,
      );
    }
  }

  if (avatar && typeof avatar === "object" && avatar.vendor === "heygen") {
    (avatar as Record<string, unknown>).vendor = "liveavatar";
  }

  const customAdvanced = properties.advanced_features as
    | { enable_mllm?: boolean }
    | undefined;
  const customMllm = properties.mllm as MllmConfig | undefined;
  if (customAdvanced?.enable_mllm && customMllm) {
    const { style, apiKey, payload } = buildMllmInvitePayload(
      customMllm,
      shouldInjectServerKey,
    );
    if (!apiKey) {
      return NextResponse.json(
        {
          error: `${getMllmApiKeyEnvName(style)} is not configured. Set it in .env or provide mllm.api_key in the custom payload.`,
        },
        { status: 400 },
      );
    }
    properties.mllm = payload;
    delete properties.llm;
    delete properties.tts;
    delete properties.asr;
    delete properties.turn_detection;
    const adv =
      typeof properties.advanced_features === "object" &&
      properties.advanced_features != null
        ? (properties.advanced_features as Record<string, unknown>)
        : {};
    properties.advanced_features = {
      ...adv,
      enable_mllm: true,
      enable_tools: false,
    };
  }

  if (avatar?.enable && properties.tts && typeof properties.tts === "object") {
    const tts = properties.tts as Record<string, unknown>;
    const v = avatar.vendor as string | undefined;
    if (tts.params && typeof tts.params === "object") {
      const tp = tts.params as Record<string, unknown>;
      if (isLiveAvatarVendor(v) || v === "anam") {
        tp.sample_rate = 24000;
      } else if (v === "akool") {
        tp.sample_rate = 16000;
      }
    }
  }

  const joinPayload = { name: customJoinPayload.name, properties };
  const authHeader = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_SECRET}`).toString(
    "base64",
  );
  const apiUrl = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${APP_ID}/join`;

  const sanitized = JSON.parse(JSON.stringify(joinPayload)) as Record<
    string,
    unknown
  >;
  if (sanitized.properties && typeof sanitized.properties === "object") {
    const p = sanitized.properties as Record<string, unknown>;
    if (p.token) p.token = String(p.token).substring(0, 20) + "...";
    if ((p.llm as Record<string, unknown>)?.api_key)
      (p.llm as Record<string, unknown>).api_key = "***MASKED***";
    if (
      (p.tts as Record<string, unknown>)?.params &&
      typeof (p.tts as Record<string, unknown>).params === "object"
    ) {
      (
        (p.tts as Record<string, unknown>).params as Record<string, unknown>
      ).key = "***MASKED***";
    }
    if (
      (p.avatar as Record<string, unknown>)?.params &&
      typeof (p.avatar as Record<string, unknown>).params === "object"
    ) {
      const ap = (p.avatar as Record<string, unknown>).params as Record<
        string,
        unknown
      >;
      ap.api_key = "***MASKED***";
      if (ap.agora_token)
        ap.agora_token = String(ap.agora_token).substring(0, 20) + "...";
    }
  }
  console.log(
    "[Agent invite] Custom payload join request:",
    JSON.stringify(sanitized, null, 2),
  );
  if (
    process.env.AGORA_LOG_PAYLOAD_VERBOSE === "1" ||
    process.env.AGORA_LOG_PAYLOAD_VERBOSE === "true"
  ) {
    console.log(
      "[Agent invite] [VERBOSE] Full request payload (no masking):",
      JSON.stringify(joinPayload, null, 2),
    );
  }

  const agoraResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify(joinPayload),
  });
  const responseData = await agoraResponse.json();

  if (!agoraResponse.ok) {
    console.error(
      "Agora Conversational AI join failed (custom payload):",
      responseData,
    );
    return NextResponse.json(
      { error: "Failed to start AI agent", details: responseData },
      { status: agoraResponse.status },
    );
  }

  const response: Record<string, string> = {
    agentId: responseData.agent_id,
    status: responseData.status,
    agentRtcUid: String(agentUid),
  };
  if (avatarRtcUidReturn != null) response.avatarRtcUid = avatarRtcUidReturn;
  return NextResponse.json(response);
}

type InviteBody = {
  channelName: string;
  uid: string;
  agentSettings: AgentSettings;
  useCustomPayload?: boolean;
  customJoinPayload?: { name: string; properties: Record<string, unknown> };
  /** User display name; injected as llm.template_variables.username for greeting */
  username?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InviteBody;
    const {
      channelName,
      uid,
      agentSettings,
      useCustomPayload,
      customJoinPayload,
      username,
    } = body;

    if (!channelName || !uid) {
      return NextResponse.json(
        { error: "channelName and uid are required" },
        { status: 400 },
      );
    }

    if (
      useCustomPayload &&
      customJoinPayload?.name &&
      customJoinPayload?.properties
    ) {
      return await handleCustomPayloadJoin(
        channelName,
        uid,
        customJoinPayload,
        username,
      );
    }

    if (!agentSettings) {
      return NextResponse.json(
        { error: "agentSettings is required" },
        { status: 400 },
      );
    }

    if (!APP_CERTIFICATE || !CUSTOMER_ID || !CUSTOMER_SECRET) {
      return NextResponse.json(
        {
          error:
            "Server missing Agora credentials. Check environment variables.",
        },
        { status: 500 },
      );
    }

    // Generate token for the agent
    // When RTM is enabled, use buildTokenWithRtm to grant both RTC and Signaling privileges
    const agentUid = 0; // Let Agora assign UID
    const agentAccount = String(agentUid); // "0" - required for buildTokenWithRtm
    const tokenExpiration = 3600; // 1 hour
    const privilegeExpiration = 3600;

    console.log("\n========== AGENT INVITE DEBUG ==========");
    console.log("Channel Name (for token):", channelName);
    console.log("User UID:", uid);
    console.log("Agent UID:", agentUid);
    console.log("APP_ID:", APP_ID);
    console.log("APP_CERTIFICATE exists:", !!APP_CERTIFICATE);
    console.log("==========================================\n");

    // Build the join payload for Agora Conversational AI API v2
    // Based on: https://docs.agora.io/en/conversational-ai/rest-api/agent/join
    const {
      llm,
      tts,
      asr,
      turn_detection,
      advanced_features,
      parameters,
      avatar,
      mllm,
    } = agentSettings;
    const useMllm = Boolean(advanced_features?.enable_mllm);

    // Generate token with RTC+RTM privileges when RTM is enabled
    // Per: https://docs.agora.io/en/help/integration-issues/rtc_rtm_token
    const agentRtcToken = advanced_features?.enable_rtm
      ? RtcTokenBuilder.buildTokenWithRtm(
          APP_ID,
          APP_CERTIFICATE,
          channelName,
          agentAccount,
          RtcRole.PUBLISHER,
          tokenExpiration,
          privilegeExpiration,
        )
      : RtcTokenBuilder.buildTokenWithUid(
          APP_ID,
          APP_CERTIFICATE,
          channelName,
          agentUid,
          RtcRole.PUBLISHER,
          tokenExpiration,
          privilegeExpiration,
        );

    // Helper: true when client sent empty/sentinel so we inject key from server (keys never exposed to client)
    const shouldInjectServerKey = (v: string | undefined) =>
      !v || v.trim() === "" || v === "__USE_SERVER__" || v === "***MASKED***";

    // Build LLM config (inject server key when client does not provide one)
    const llmApiKey = shouldInjectServerKey(llm.api_key)
      ? (
          process.env.LLM_API_KEY ||
          process.env.NEXT_PUBLIC_LLM_API_KEY ||
          ""
        ).trim()
      : (llm.api_key ?? "").trim();
    const llmPayload: Record<string, unknown> = {
      url: llm.url,
      api_key: llmApiKey,
    };

    if (llm.headers) {
      llmPayload.headers = llm.headers;
    }

    if (llm.system_messages && llm.system_messages.length > 0) {
      llmPayload.system_messages = llm.system_messages;
    }

    const displayName =
      username != null && username !== "" ? username : "Guest";
    llmPayload.template_variables = {
      ...(typeof llm.template_variables === "object" &&
      llm.template_variables != null
        ? llm.template_variables
        : {}),
      username: displayName,
    };

    if (llm.greeting_message) {
      llmPayload.greeting_message = llm.greeting_message;
    }

    if (llm.greeting_configs?.mode) {
      llmPayload.greeting_configs = { mode: llm.greeting_configs.mode };
    }

    if (llm.failure_message) {
      llmPayload.failure_message = llm.failure_message;
    }

    if (llm.max_history) {
      llmPayload.max_history = llm.max_history;
    }

    if (llm.style) {
      llmPayload.style = llm.style;
    }

    if (llm.params) {
      llmPayload.params = llm.params;
    }

    // Image modality: default to text + image so agent can receive picture messages
    // When RTM is explicitly disabled (RTC mode), use text-only so we don't force RTM
    const rtmExplicitlyDisabled = advanced_features?.enable_rtm === false;
    llmPayload.input_modalities =
      rtmExplicitlyDisabled ? ["text"] : (llm.input_modalities ?? ["text", "image"]);

    // v2.x output_modalities: when omitted server defaults to ["text"].
    // Include only when caller explicitly set it (so we don't override defaults).
    if (llm.output_modalities && llm.output_modalities.length > 0) {
      llmPayload.output_modalities = llm.output_modalities;
    }

    // Build MCP servers for LLM (tool invocation) — only include enabled servers
    const enabledMcpServers = (llm.mcp_servers ?? []).filter(
      (s) => s.enabled !== false,
    );
    if (enabledMcpServers.length > 0) {
      llmPayload.mcp_servers = enabledMcpServers.map((s) => {
        const mergedQueries = { ...s.queries };
        const endpoint =
          Object.keys(mergedQueries).length > 0
            ? `${s.endpoint.replace(/\?$/, "")}?${new URLSearchParams(mergedQueries).toString()}`
            : s.endpoint;
        const mergedHeaders = { ...s.headers };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { enabled, queries, endpoint: _ep, headers: _h, ...rest } = s;
        return {
          ...rest,
          endpoint,
          ...(Object.keys(mergedHeaders).length > 0 && {
            headers: mergedHeaders,
          }),
        };
      });
    }

    // Build TTS config (inject server key when client does not provide one)
    const ttsParams = { ...tts.params } as Record<string, unknown>;
    const ttsKey = (ttsParams.key as string) ?? "";
    if (shouldInjectServerKey(ttsKey)) {
      const vendor = (tts.vendor ?? "microsoft") as string;
      if (vendor === "elevenlabs") {
        ttsParams.key = (
          process.env.ELEVENLABS_API_KEY ||
          process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY ||
          ""
        ).trim();
      } else if (vendor === "openai") {
        ttsParams.key = (
          process.env.OPENAI_TTS_KEY ||
          process.env.NEXT_PUBLIC_OPENAI_TTS_KEY ||
          ""
        ).trim();
      } else if (vendor === "deepgram") {
        ttsParams.key = (
          process.env.DEEPGRAM_TTS_KEY ||
          process.env.DEEPGRAM_API_KEY ||
          process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ||
          ""
        ).trim();
      } else {
        ttsParams.key = (
          process.env.MICROSOFT_TTS_KEY ||
          process.env.NEXT_PUBLIC_MICROSOFT_TTS_KEY ||
          ""
        ).trim();
      }
    }
    if ((tts.vendor ?? "microsoft") === "elevenlabs") {
      const vid = String((ttsParams.voice_id as string) ?? "").trim();
      if (!vid) {
        ttsParams.voice_id =
          (process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "").trim() ||
          ELEVENLABS_DEFAULT_VOICE_ID;
      }
    }
    const ttsPayload: Record<string, unknown> = {
      vendor: tts.vendor,
      params: ttsParams,
    };

    // LiveAvatar / Anam: TTS 24 kHz. Akool: 16 kHz (Agora avatar docs).
    if (avatar?.enable) {
      if (isLiveAvatarVendor(avatar.vendor) || avatar.vendor === "anam") {
        ttsParams.sample_rate = 24000;
        ttsPayload.params = ttsParams;
      } else if (avatar.vendor === "akool") {
        ttsParams.sample_rate = 16000;
        ttsPayload.params = ttsParams;
      }
    }

    // Build ASR config (optional); inject server key when client does not provide one
    const asrPayload: Record<string, unknown> | undefined = asr
      ? {
          ...(asr.vendor && { vendor: asr.vendor }),
          ...(asr.language && { language: asr.language }),
          ...(asr.params &&
            Object.keys(asr.params).length > 0 && {
              params: { ...asr.params },
            }),
        }
      : undefined;
    if (asrPayload?.params && typeof asrPayload.params === "object") {
      const p = asrPayload.params as Record<string, unknown>;
      const keyVal = (p.api_key as string) ?? (p.key as string) ?? "";
      if (shouldInjectServerKey(keyVal)) {
        const vendor = (asr?.vendor ?? "ares") as string;
        if (vendor === "deepgram") {
          p.api_key = (
            process.env.DEEPGRAM_API_KEY ||
            process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY ||
            ""
          ).trim();
        } else if (vendor === "microsoft") {
          p.key = (
            process.env.MICROSOFT_ASR_KEY ||
            process.env.NEXT_PUBLIC_MICROSOFT_ASR_KEY ||
            ""
          ).trim();
        }
      }
    }

    // When avatar is enabled, Agora does not allow "subscribe all" (*).
    // Must specify the local user's UID explicitly.
    const remoteRtcUids = avatar?.enable ? [String(uid)] : ["*"];

    // Build the complete properties payload
    const propertiesPayload: Record<string, unknown> = {
      channel: channelName,
      token: agentRtcToken,
      agent_rtc_uid: String(agentUid),
      remote_rtc_uids: remoteRtcUids,
      enable_string_uid: false,
      idle_timeout: agentSettings.idle_timeout || 30,
    };

    if (useMllm) {
      if (!mllm) {
        return NextResponse.json(
          {
            error:
              "enable_mllm is true but mllm configuration is missing from agent settings.",
          },
          { status: 400 },
        );
      }
      const { style, apiKey, payload } = buildMllmInvitePayload(
        mllm,
        shouldInjectServerKey,
      );
      if (!apiKey) {
        return NextResponse.json(
          {
            error: `${getMllmApiKeyEnvName(style)} is not configured. Set it in .env or provide an API key in Settings.`,
          },
          { status: 400 },
        );
      }
      propertiesPayload.mllm = payload;
    } else {
      propertiesPayload.llm = llmPayload;
      propertiesPayload.tts = ttsPayload;
      if (asrPayload && Object.keys(asrPayload).length > 0) {
        propertiesPayload.asr = asrPayload;
      }
    }

    // Add turn detection (Agora v2 config format)
    const legacyTurn = turn_detection as
      | { silence_duration_ms?: number; mode?: string }
      | undefined;
    const turnDetectionNormalized =
      turn_detection && (turn_detection as TurnDetectionConfig).config
        ? (turn_detection as TurnDetectionConfig)
        : turn_detection && !(turn_detection as TurnDetectionConfig).config
          ? ({
              mode: "default" as const,
              config: {
                speech_threshold: 0.5,
                start_of_speech: {
                  mode: "vad" as const,
                  vad_config: {
                    interrupt_duration_ms: 160,
                    speaking_interrupt_duration_ms: 160,
                    prefix_padding_ms: 800,
                  },
                },
                end_of_speech: {
                  mode: (legacyTurn?.mode === "semantic"
                    ? "semantic"
                    : "vad") as "vad" | "semantic",
                  ...(legacyTurn?.mode === "semantic"
                    ? {
                        semantic_config: {
                          silence_duration_ms: 320,
                          max_wait_ms: 3000,
                        },
                      }
                    : {
                        vad_config: {
                          silence_duration_ms:
                            legacyTurn?.silence_duration_ms ?? 640,
                        },
                      }),
                },
              },
            } as TurnDetectionConfig)
          : null;
    // Only include turn_detection when user has enabled it (draft vs apply).
    // Classic pipeline only — MLLM uses mllm.turn_detection.
    if (
      !useMllm &&
      agentSettings.enable_turn_detection &&
      turnDetectionNormalized
    ) {
      const td = turnDetectionNormalized;
      const cfg = td.config!;
      const start = cfg.start_of_speech;
      const end = cfg.end_of_speech;
      const turnPayload: Record<string, unknown> = {
        mode: td.mode ?? "default",
        config: {
          ...(cfg.speech_threshold != null && {
            speech_threshold: cfg.speech_threshold,
          }),
          ...(start &&
            (() => {
              const base: Record<string, unknown> = { mode: start.mode };
              if (start.mode === "vad" && start.vad_config) {
                base.vad_config = {
                  interrupt_duration_ms:
                    start.vad_config.interrupt_duration_ms ?? 160,
                  speaking_interrupt_duration_ms:
                    start.vad_config.speaking_interrupt_duration_ms ?? 160,
                  prefix_padding_ms: start.vad_config.prefix_padding_ms ?? 800,
                };
              }
              if (start.mode === "keywords" && start.keywords_config) {
                base.keywords_config = {
                  interrupt_duration_ms:
                    start.keywords_config.interrupt_duration_ms ?? 160,
                  prefix_padding_ms:
                    start.keywords_config.prefix_padding_ms ?? 800,
                  ...(start.keywords_config.triggered_keywords?.length && {
                    triggered_keywords:
                      start.keywords_config.triggered_keywords,
                  }),
                };
              }
              if (start.mode === "disabled" && start.disabled_config) {
                base.disabled_config = {
                  strategy: start.disabled_config.strategy ?? "append",
                };
              }
              return { start_of_speech: base };
            })()),
          ...(end &&
            (() => {
              const base: Record<string, unknown> = { mode: end.mode };
              if (end.mode === "vad" && end.vad_config) {
                base.vad_config = {
                  silence_duration_ms:
                    end.vad_config.silence_duration_ms ?? 640,
                };
              }
              if (end.mode === "semantic" && end.semantic_config) {
                base.semantic_config = {
                  silence_duration_ms:
                    end.semantic_config.silence_duration_ms ?? 320,
                  max_wait_ms: end.semantic_config.max_wait_ms ?? 3000,
                };
              }
              return { end_of_speech: base };
            })()),
        },
      };
      propertiesPayload.turn_detection = turnPayload;
    }

    // Add filler words when enabled
    const filler_words = agentSettings.filler_words as
      | FillerWordsConfig
      | undefined;
    if (filler_words?.enable) {
      const responseWaitMs =
        filler_words.trigger?.fixed_time_config?.response_wait_ms ?? 1500;
      const phrases = filler_words.content?.static_config?.phrases ?? [
        "Please wait.",
        "Okay.",
        "Uh-huh.",
      ];
      const selectionRule =
        filler_words.content?.static_config?.selection_rule ?? "shuffle";
      propertiesPayload.filler_words = {
        enable: true,
        trigger: {
          mode: "fixed_time",
          fixed_time_config: { response_wait_ms: responseWaitMs },
        },
        content: {
          mode: "static",
          static_config: {
            phrases: phrases.length
              ? phrases
              : ["Please wait.", "Okay.", "Uh-huh."],
            selection_rule: selectionRule,
          },
        },
      };
    }

    // Add SAL only when advanced_features.enable_sal is true
    if (advanced_features?.enable_sal) {
      const sal = agentSettings.sal as SalConfig | undefined;
      const salPayload: Record<string, unknown> = {
        sal_mode: sal?.sal_mode ?? "locking",
      };
      if (sal?.sample_urls && Object.keys(sal.sample_urls).length > 0) {
        salPayload.sample_urls = sal.sample_urls;
      }
      propertiesPayload.sal = salPayload;
    }

    // When image modality is enabled, RTM is required for picture messages.
    // When user explicitly disabled RTM (RTC mode), we already set input_modalities to ["text"] above.
    const inputModalities = (llmPayload.input_modalities as (
      | "text"
      | "image"
    )[]) ?? ["text", "image"];
    const needsRtmForImage =
      !useMllm && !rtmExplicitlyDisabled && inputModalities.includes("image");

    // Add advanced features; auto-enable tools when any enabled MCP server is configured
    const hasMcpServers = enabledMcpServers.length > 0;
    const enableTools = hasMcpServers || advanced_features?.enable_tools;
    if (advanced_features || hasMcpServers || needsRtmForImage) {
      propertiesPayload.advanced_features = {
        // Enable RTM when explicitly set or when image modality is used (required for picture messages)
        enable_rtm:
          (needsRtmForImage || advanced_features?.enable_rtm) ?? false,
        ...(advanced_features?.enable_sal !== undefined && {
          enable_sal: advanced_features.enable_sal,
        }),
        ...(useMllm && { enable_mllm: true }),
        enable_tools: useMllm ? false : enableTools,
      };
    } else if (useMllm) {
      propertiesPayload.advanced_features = { enable_mllm: true };
    }

    // Add agent parameters
    // data_channel: "datastream" when RTM is disabled (RTC transcript), "rtm" when RTM is enabled (chat + transcript)
    const useRtm = needsRtmForImage || advanced_features?.enable_rtm;
    if (parameters || advanced_features || needsRtmForImage) {
      propertiesPayload.parameters = {
        ...(parameters?.enable_farewell !== undefined && {
          enable_farewell: parameters.enable_farewell,
        }),
        ...(parameters?.farewell_phrases && {
          farewell_phrases: parameters.farewell_phrases,
        }),
        data_channel: useRtm ? "rtm" : "datastream",
      };
    }

    // Avatar RTC UID for client (returned when avatar is enabled)
    let avatarRtcUidReturn: string | null = null;

    // Add avatar configuration if enabled
    if (avatar?.enable) {
      // Use a distinct avatar UID (999999) to avoid conflicts with agent (0) or user
      const avatarUid = 999999;
      avatarRtcUidReturn = String(avatarUid);
      const avatarRtcToken = RtcTokenBuilder.buildTokenWithUid(
        APP_ID,
        APP_CERTIFICATE,
        channelName,
        avatarUid,
        RtcRole.PUBLISHER,
        tokenExpiration,
        privilegeExpiration,
      );

      // Build avatar params based on vendor
      const avatarParams: Record<string, unknown> = {
        agora_uid: String(avatarUid),
        agora_token: avatarRtcToken,
      };

      // Add vendor-specific params
      if (avatar.vendor === "akool") {
        const akoolParams = avatar.params as {
          api_key?: string;
          avatar_id?: string;
        };
        const akoolApiKey =
          (shouldInjectServerKey(akoolParams.api_key)
            ? ""
            : (akoolParams.api_key ?? "").trim()) ||
          (
            process.env.AKOOL_API_KEY ||
            process.env.NEXT_PUBLIC_AKOOL_API_KEY ||
            ""
          ).trim();
        const akoolAvatarId = (
          akoolParams.avatar_id ??
          process.env.NEXT_PUBLIC_AKOOL_AVATAR_ID ??
          ""
        ).trim();
        if (!akoolApiKey) {
          console.warn(
            "[Agent invite] Akool avatar enabled but api_key is missing. Set AKOOL_API_KEY or pass avatar.params.api_key.",
          );
          return NextResponse.json(
            {
              error:
                "Akool avatar requires api_key. Set AKOOL_API_KEY or configure avatar.params.api_key.",
            },
            { status: 400 },
          );
        }
        if (!akoolAvatarId) {
          console.warn(
            "[Agent invite] Akool avatar enabled but avatar_id is missing. Set NEXT_PUBLIC_AKOOL_AVATAR_ID or pass avatar.params.avatar_id.",
          );
          return NextResponse.json(
            {
              error:
                "Akool avatar requires avatar_id. Set NEXT_PUBLIC_AKOOL_AVATAR_ID or select an avatar in settings.",
            },
            { status: 400 },
          );
        }
        avatarParams.api_key = akoolApiKey;
        avatarParams.avatar_id = akoolAvatarId;
      } else if (avatar.vendor === "heygen") {
        const heygenParams = avatar.params as {
          api_key?: string;
          quality?: string;
          avatar_id?: string;
          disable_idle_timeout?: boolean;
          activity_idle_timeout?: number;
        };
        const heygenApiKey =
          (shouldInjectServerKey(heygenParams.api_key)
            ? ""
            : (heygenParams.api_key ?? "").trim()) ||
          (
            process.env.HEYGEN_API_KEY ||
            process.env.NEXT_PUBLIC_HEYGEN_API_KEY ||
            ""
          ).trim();
        const heygenAvatarId = heygenParams.avatar_id ?? "";
        if (!heygenApiKey.trim()) {
          console.warn(
            "[Agent invite] HeyGen avatar enabled but api_key is missing. Set HEYGEN_API_KEY or pass avatar.params.api_key.",
          );
          return NextResponse.json(
            {
              error:
                "HeyGen avatar requires api_key. Set HEYGEN_API_KEY or configure avatar.params.api_key.",
            },
            { status: 400 },
          );
        }
        if (!heygenAvatarId.trim()) {
          console.warn(
            "[Agent invite] HeyGen avatar enabled but avatar_id is missing. Select an avatar from the settings panel.",
          );
          return NextResponse.json(
            {
              error:
                "HeyGen avatar requires avatar_id. Please select an avatar from the settings panel.",
            },
            { status: 400 },
          );
        }
        avatarParams.api_key = heygenApiKey;
        avatarParams.quality =
          heygenParams.quality ||
          process.env.NEXT_PUBLIC_HEYGEN_QUALITY ||
          "medium";
        avatarParams.avatar_id = heygenAvatarId;
        avatarParams.disable_idle_timeout =
          heygenParams.disable_idle_timeout ?? false;
        avatarParams.activity_idle_timeout =
          heygenParams.activity_idle_timeout ?? 60;
        // HeyGen avatars only support TTS at 24,000 Hz. Ensure TTS is configured for 24k when using HeyGen.
      } else if (avatar.vendor === "anam") {
        const anamParams = avatar.params as {
          api_key?: string;
          anam_api_key?: string;
          avatar_id?: string;
          anam_avatar_id?: string;
          sample_rate?: number;
          quality?: string;
          video_encoding?: string;
        };
        const anamApiKey =
          (shouldInjectServerKey(anamParams.api_key ?? anamParams.anam_api_key)
            ? ""
            : (anamParams.anam_api_key ?? anamParams.api_key ?? "").trim()) ||
          (
            process.env.ANAM_API_KEY ||
            process.env.NEXT_PUBLIC_ANAM_API_KEY ||
            ""
          ).trim();
        const anamAvatarId = (
          anamParams.anam_avatar_id ??
          anamParams.avatar_id ??
          process.env.NEXT_PUBLIC_ANAM_AVATAR_ID ??
          ""
        ).trim();
        if (!anamApiKey) {
          console.warn(
            "[Agent invite] Anam avatar enabled but api_key is missing. Set ANAM_API_KEY or pass avatar.params.api_key.",
          );
          return NextResponse.json(
            {
              error:
                "Anam avatar requires api_key. Set ANAM_API_KEY or configure avatar.params.api_key.",
            },
            { status: 400 },
          );
        }
        if (!anamAvatarId) {
          console.warn(
            "[Agent invite] Anam avatar enabled but avatar_id is missing. Set NEXT_PUBLIC_ANAM_AVATAR_ID or pass avatar.params.avatar_id.",
          );
          return NextResponse.json(
            {
              error:
                "Anam avatar requires avatar_id. Set NEXT_PUBLIC_ANAM_AVATAR_ID or select an avatar in settings.",
            },
            { status: 400 },
          );
        }
        avatarParams.api_key = anamApiKey;
        avatarParams.avatar_id = anamAvatarId;
        avatarParams.sample_rate = anamParams.sample_rate ?? 24000;
        avatarParams.quality = anamParams.quality ?? "high";
        avatarParams.video_encoding = anamParams.video_encoding ?? "H264";
      }

      propertiesPayload.avatar = {
        enable: true,
        vendor: agoraAvatarVendorForApi(avatar.vendor),
        params: avatarParams,
      };
    }

    const joinPayload = {
      name: agentSettings.name,
      properties: propertiesPayload,
    };

    // Call Agora Conversational AI API
    const authHeader = Buffer.from(
      `${CUSTOMER_ID}:${CUSTOMER_SECRET}`,
    ).toString("base64");
    const apiUrl = `https://api.agora.io/api/conversational-ai-agent/v2/projects/${APP_ID}/join`;

    // Create a sanitized version for logging (mask sensitive data)
    const sanitizedPayload = JSON.parse(JSON.stringify(joinPayload));
    if (sanitizedPayload.properties?.token) {
      sanitizedPayload.properties.token =
        sanitizedPayload.properties.token.substring(0, 20) + "...";
    }
    if (sanitizedPayload.properties?.llm?.api_key) {
      sanitizedPayload.properties.llm.api_key = "***MASKED***";
    }
    if (sanitizedPayload.properties?.mllm?.api_key) {
      sanitizedPayload.properties.mllm.api_key = "***MASKED***";
    }
    if (sanitizedPayload.properties?.tts?.params?.key) {
      sanitizedPayload.properties.tts.params.key = "***MASKED***";
    }
    if (sanitizedPayload.properties?.avatar?.params?.api_key) {
      sanitizedPayload.properties.avatar.params.api_key = "***MASKED***";
    }
    if (sanitizedPayload.properties?.avatar?.params?.agora_token) {
      sanitizedPayload.properties.avatar.params.agora_token =
        sanitizedPayload.properties.avatar.params.agora_token.substring(0, 20) +
        "...";
    }

    console.log("\n========== AGORA CONVERSATIONAL AI REQUEST ==========");
    console.log("URL:", apiUrl);
    console.log("Method: POST");
    console.log("Headers:", {
      "Content-Type": "application/json",
      Authorization: "Basic ***MASKED***",
    });
    console.log("Payload:", JSON.stringify(sanitizedPayload, null, 2));
    // When AGORA_LOG_PAYLOAD_VERBOSE=1, log full payload (no masking) for verification
    if (
      process.env.AGORA_LOG_PAYLOAD_VERBOSE === "1" ||
      process.env.AGORA_LOG_PAYLOAD_VERBOSE === "true"
    ) {
      console.log("\n[VERBOSE] Full request payload (no masking):");
      console.log(JSON.stringify(joinPayload, null, 2));
    }
    console.log("=====================================================\n");

    const agoraResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(joinPayload),
    });

    const responseData = await agoraResponse.json();

    console.log("\n========== AGORA CONVERSATIONAL AI RESPONSE ==========");
    console.log("Status:", agoraResponse.status, agoraResponse.statusText);
    console.log("Response:", JSON.stringify(responseData, null, 2));
    console.log("======================================================\n");

    if (!agoraResponse.ok) {
      console.error("Agora Conversational AI join failed:", responseData);
      return NextResponse.json(
        { error: "Failed to start AI agent", details: responseData },
        { status: agoraResponse.status },
      );
    }

    console.log("Agent started successfully with ID:", responseData.agent_id);

    const response: {
      agentId: string;
      status: string;
      agentRtcUid: string;
      avatarRtcUid?: string;
    } = {
      agentId: responseData.agent_id,
      status: responseData.status,
      agentRtcUid: String(agentUid),
    };
    if (avatarRtcUidReturn != null) {
      response.avatarRtcUid = avatarRtcUidReturn;
    }
    return NextResponse.json(response);
  } catch (error) {
    console.error("Agent invite error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
