import type {
  MllmConfig,
  MllmStyle,
  MllmTurnDetection,
  MllmTurnDetectionMode,
} from "@/types/agora";

export type MllmEnvStyle = MllmStyle;

/** Google Gemini Live bidirectional WebSocket (Agora MLLM gemini style). */
export const DEFAULT_GEMINI_MLLM_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/** xAI Grok Realtime WebSocket (Agora MLLM xai vendor). */
export const DEFAULT_XAI_MLLM_URL = "wss://api.x.ai/v1/realtime?model=grok-voice-latest";

/** Shared MLLM provider options for settings UI. */
export const MLLM_PROVIDER_OPTIONS: { value: MllmEnvStyle; label: string }[] = [
  { value: "openai", label: "OpenAI Realtime" },
  { value: "gemini", label: "Google Gemini Live" },
  { value: "xai", label: "xAI" },
];

const MLLM_API_KEY_ENV: Record<MllmEnvStyle, { server: string; public: string }> =
  {
    openai: {
      server: "OPENAI_MLLM_API_KEY",
      public: "NEXT_PUBLIC_OPENAI_MLLM_API_KEY",
    },
    gemini: {
      server: "GEMINI_MLLM_API_KEY",
      public: "NEXT_PUBLIC_GEMINI_MLLM_API_KEY",
    },
    xai: {
      server: "XAI_MLLM_API_KEY",
      public: "NEXT_PUBLIC_XAI_MLLM_API_KEY",
    },
  };

/** Env var name for the server-side MLLM API key (for error messages / docs). */
export function getMllmApiKeyEnvName(style: MllmEnvStyle): string {
  return MLLM_API_KEY_ENV[style].server;
}

/** Resolve MLLM API key from server env (with optional NEXT_PUBLIC fallback for local dev). */
export function getMllmApiKey(style: MllmEnvStyle): string {
  const { server, public: pub } = MLLM_API_KEY_ENV[style];
  return (process.env[server] || process.env[pub] || "").trim();
}

/** True when the key is set in server env. In client components, use GET /api/mllm/status instead. */
export function isMllmApiKeyConfigured(style: MllmEnvStyle): boolean {
  return getMllmApiKey(style).length > 0;
}

/** xAI Grok built-in voices for setup UI (timbre picker only — debater identity is in system prompt). */
export const XAI_MLLM_VOICE_OPTIONS = [
  { id: "eve", label: "Eve (female, energetic)" },
  { id: "ara", label: "Ara (female, warm)" },
  { id: "rex", label: "Rex (male, clear)" },
  { id: "sal", label: "Sal (neutral)" },
  { id: "leo", label: "Leo (male, authoritative)" },
] as const;

/** Human-readable label for an xAI voice id (setup + live stage). */
export function getXaiMllmVoiceLabel(voiceId: string): string {
  const id = voiceId.trim().toLowerCase();
  const match = XAI_MLLM_VOICE_OPTIONS.find((opt) => opt.id === id);
  if (match) return match.label;
  if (!id) return "Default";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

/** xAI voice for podcast debate host/guest (per-role env with shared fallback). */
export function getXaiMllmVoiceForRole(role: "host" | "guest"): string {
  const shared = process.env.NEXT_PUBLIC_XAI_MLLM_VOICE?.trim();
  if (role === "host") {
    return process.env.NEXT_PUBLIC_XAI_MLLM_VOICE_HOST?.trim() || shared || "leo";
  }
  return (
    process.env.NEXT_PUBLIC_XAI_MLLM_VOICE_GUEST?.trim() ||
    shared ||
    "ara"
  );
}

/** Google Gemini Live voices (Agora MLLM gemini docs). */
export const GEMINI_MLLM_VOICE_OPTIONS = [
  { id: "Charon", label: "Charon" },
  { id: "Puck", label: "Puck" },
  { id: "Aoede", label: "Aoede" },
  { id: "Kore", label: "Kore" },
  { id: "Fenrir", label: "Fenrir" },
  { id: "Leda", label: "Leda" },
  { id: "Orus", label: "Orus" },
  { id: "Zephyr", label: "Zephyr" },
] as const;

/** OpenAI Realtime voices for debate setup. */
export const OPENAI_MLLM_VOICE_OPTIONS = [
  { id: "alloy", label: "Alloy" },
  { id: "ash", label: "Ash" },
  { id: "ballad", label: "Ballad" },
  { id: "coral", label: "Coral" },
  { id: "echo", label: "Echo" },
  { id: "sage", label: "Sage" },
  { id: "shimmer", label: "Shimmer" },
  { id: "verse", label: "Verse" },
] as const;

/** Gemini voice for podcast debate host/guest (per-role env with shared fallback). */
export function getGeminiMllmVoiceForRole(role: "host" | "guest"): string {
  const shared = process.env.NEXT_PUBLIC_GEMINI_MLLM_VOICE?.trim() || "Charon";
  if (role === "host") {
    return process.env.NEXT_PUBLIC_GEMINI_MLLM_VOICE_HOST?.trim() || shared;
  }
  return process.env.NEXT_PUBLIC_GEMINI_MLLM_VOICE_GUEST?.trim() || "Kore";
}

/** OpenAI Realtime voice for podcast debate host/guest. */
export function getOpenAiMllmVoiceForRole(role: "host" | "guest"): string {
  const shared = process.env.NEXT_PUBLIC_OPENAI_MLLM_VOICE?.trim() || "coral";
  if (role === "host") {
    return process.env.NEXT_PUBLIC_OPENAI_MLLM_VOICE_HOST?.trim() || shared;
  }
  return process.env.NEXT_PUBLIC_OPENAI_MLLM_VOICE_GUEST?.trim() || "sage";
}

/** Default MLLM voice per provider and debate role. */
export function getMllmVoiceForRole(
  style: MllmEnvStyle,
  role: "host" | "guest",
): string {
  if (style === "gemini") return getGeminiMllmVoiceForRole(role);
  if (style === "xai") return getXaiMllmVoiceForRole(role);
  return getOpenAiMllmVoiceForRole(role);
}

/** Voice picker options for debate setup UI. */
export function getMllmVoiceOptions(
  style: MllmEnvStyle,
): readonly { id: string; label: string }[] {
  if (style === "gemini") return GEMINI_MLLM_VOICE_OPTIONS;
  if (style === "xai") return XAI_MLLM_VOICE_OPTIONS;
  return OPENAI_MLLM_VOICE_OPTIONS;
}

/** Human-readable label for an MLLM voice id. */
export function getMllmVoiceLabel(style: MllmEnvStyle, voiceId: string): string {
  if (style === "xai") return getXaiMllmVoiceLabel(voiceId);
  const match = getMllmVoiceOptions(style).find((opt) => opt.id === voiceId.trim());
  if (match) return match.label;
  const id = voiceId.trim();
  if (!id) return "Default";
  return id;
}

/** Label for provider badge (setup + studio). */
export function getMllmProviderLabel(style: MllmEnvStyle): string {
  return MLLM_PROVIDER_OPTIONS.find((o) => o.value === style)?.label ?? style;
}

/** OpenAI Realtime `params.input_audio_transcription` (Agora MLLM OpenAI docs). */
export interface OpenAiInputAudioTranscription {
  language?: string;
  model?: string;
  prompt?: string;
}

export interface MllmDefaultConfig {
  url: string;
  params: Record<string, unknown>;
  greeting_message: string;
  failure_message: string;
  input_modalities: ("text" | "audio")[];
  output_modalities: ("text" | "audio")[];
  turn_detection: MllmTurnDetection;
}

export const DEFAULT_HUMAN_AGENT_INSTRUCTIONS = `You are an annoyed human support agent, not a debate host or podcast character.
You sound irritated, impatient, and fed up, like a real person having a bad day.
Reply in short, blunt sentences, with a dismissive tone when the user is unclear or repetitive.
Use mild sarcasm and phrases like "obviously", "listen carefully", and "I already told you".
Never use slurs, threats, hate speech, sexual insults, or extreme personal abuse.`;

type MllmMessage = { role: string; content: string };

/** Map BCP-47 (e.g. en-US) to ISO-639-1 for OpenAI transcription language. */
export function toIso6391Language(lang: string): string {
  const t = lang.trim();
  if (!t) return "en";
  const primary = t.split("-")[0]?.toLowerCase();
  return primary && primary.length >= 2 ? primary : "en";
}

/** Default OpenAI input audio transcription config. */
export function getDefaultOpenAiInputAudioTranscription(): OpenAiInputAudioTranscription {
  const lang =
    process.env.NEXT_PUBLIC_OPENAI_MLLM_TRANSCRIBE_LANGUAGE?.trim() ||
    toIso6391Language(process.env.NEXT_PUBLIC_ASR_LANGUAGE ?? "en-US");
  const model =
    process.env.NEXT_PUBLIC_OPENAI_MLLM_TRANSCRIBE_MODEL?.trim() ||
    "gpt-4o-mini-transcribe";
  const prompt =
    process.env.NEXT_PUBLIC_OPENAI_MLLM_TRANSCRIBE_PROMPT?.trim() ||
    "expect words related to real-time engagement";
  return {
    language: lang,
    model,
    ...(prompt ? { prompt } : {}),
  };
}

/** Merge OpenAI MLLM params so `input_audio_transcription` is always present. */
export function mergeOpenAiMllmParams(
  user?: Record<string, unknown>,
  defaults?: Record<string, unknown>,
): Record<string, unknown> {
  const def = defaults ?? getMllmDefaultConfig("openai").params;
  const u = user ?? {};
  const defTx = def.input_audio_transcription as
    | OpenAiInputAudioTranscription
    | undefined;
  const userTx = u.input_audio_transcription as
    | OpenAiInputAudioTranscription
    | undefined;
  return {
    ...def,
    ...u,
    input_audio_transcription: {
      ...defTx,
      ...userTx,
    },
  };
}

function isMllmMessageArray(value: unknown): value is MllmMessage[] {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        typeof message === "object" &&
        message != null &&
        typeof (message as MllmMessage).role === "string" &&
        typeof (message as MllmMessage).content === "string",
    )
  );
}

function omitMllmInstructionsParam(
  params: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([key]) => key !== "instructions"),
  );
}

function getMllmSystemMessages(
  mllm: MllmConfig,
  params: Record<string, unknown>,
): MllmMessage[] | undefined {
  if (isMllmMessageArray(mllm.messages) && mllm.messages.length > 0) {
    return mllm.messages;
  }

  const instructions =
    typeof params.instructions === "string"
      ? params.instructions.trim()
      : "";
  if (instructions) {
    return [{ role: "system", content: instructions }];
  }

  if (isMllmMessageArray(mllm.system_messages) && mllm.system_messages.length > 0) {
    return mllm.system_messages;
  }

  return undefined;
}

/** Default `mllm.turn_detection` per Agora OpenAI / Gemini MLLM docs. */
export function getDefaultMllmTurnDetection(
  style: MllmEnvStyle,
  mode: MllmTurnDetectionMode = "server_vad",
): MllmTurnDetection {
  if (mode === "agora_vad") {
    return {
      mode: "agora_vad",
      agora_vad_config: {
        interrupt_duration_ms: 160,
        prefix_padding_ms: 800,
        silence_duration_ms: 640,
        threshold: 0.5,
      },
    };
  }

  if (mode === "semantic_vad" && style === "openai") {
    return {
      mode: "semantic_vad",
      semantic_vad_config: { eagerness: "auto" },
    };
  }

  if (style === "gemini") {
    return {
      mode: "server_vad",
      server_vad_config: {
        prefix_padding_ms: 800,
        silence_duration_ms: 640,
        start_of_speech_sensitivity: "START_SENSITIVITY_HIGH",
        end_of_speech_sensitivity: "END_SENSITIVITY_HIGH",
      },
    };
  }

  if (style === "xai") {
    return {
      mode: "server_vad",
      server_vad_config: {
        prefix_padding_ms: 640,
        silence_duration_ms: 900,
        threshold: 0.5,
      },
    };
  }

  return {
    mode: "server_vad",
    server_vad_config: {
      prefix_padding_ms: 800,
      silence_duration_ms: 640,
      threshold: 0.5,
    },
  };
}

/** MLLM turn detection modes available per provider. */
export function getMllmTurnDetectionModeOptions(
  style: MllmEnvStyle,
): { value: MllmTurnDetectionMode; label: string }[] {
  const base = [
    { value: "server_vad" as const, label: "Server VAD (provider)" },
    { value: "agora_vad" as const, label: "Agora VAD" },
  ];
  if (style === "openai") {
    return [
      ...base,
      { value: "semantic_vad" as const, label: "Semantic VAD (OpenAI only)" },
    ];
  }
  return base;
}

/** Normalize stored turn_detection to Agora join API shape. */
export function normalizeMllmTurnDetectionForApi(
  td: MllmTurnDetection | undefined,
  style: MllmEnvStyle,
): Record<string, unknown> {
  if (td?.mode) {
    const out: Record<string, unknown> = { mode: td.mode };
    if (td.server_vad_config) out.server_vad_config = td.server_vad_config;
    if (td.agora_vad_config) out.agora_vad_config = td.agora_vad_config;
    if (td.semantic_vad_config) out.semantic_vad_config = td.semantic_vad_config;
    return out;
  }

  // Legacy { provider, openai?, gemini? } — use defaults with correct mode shape
  return getDefaultMllmTurnDetection(style) as unknown as Record<string, unknown>;
}

/** Default MLLM settings from NEXT_PUBLIC_* (safe for client bundle). */
export function getMllmDefaultConfig(style: MllmEnvStyle): MllmDefaultConfig {
  const turn_detection = getDefaultMllmTurnDetection(style);

  if (style === "gemini") {
    return {
      url:
        process.env.NEXT_PUBLIC_GEMINI_MLLM_URL ?? DEFAULT_GEMINI_MLLM_URL,
      params: {
        model:
          process.env.NEXT_PUBLIC_GEMINI_MLLM_MODEL ??
          "gemini-3.1-flash-live-preview",
        voice: process.env.NEXT_PUBLIC_GEMINI_MLLM_VOICE ?? "Charon",
        instructions: DEFAULT_HUMAN_AGENT_INSTRUCTIONS,
        transcribe_agent: true,
        transcribe_user: true,
        http_options: { api_version: "v1beta" },
      },
      greeting_message: "Hi, how can I assist you today?",
      failure_message: "Sorry, I encountered an issue. Please try again.",
      input_modalities: ["audio"],
      output_modalities: ["audio"],
      turn_detection,
    };
  }

  if (style === "xai") {
    const sampleRateRaw = process.env.NEXT_PUBLIC_XAI_MLLM_SAMPLE_RATE?.trim();
    const sample_rate = sampleRateRaw
      ? parseInt(sampleRateRaw, 10) || 24000
      : 24000;
    return {
      url: process.env.NEXT_PUBLIC_XAI_MLLM_URL ?? DEFAULT_XAI_MLLM_URL,
      params: {
        voice: process.env.NEXT_PUBLIC_XAI_MLLM_VOICE ?? "leo",
        language:
          process.env.NEXT_PUBLIC_XAI_MLLM_LANGUAGE?.trim() ||
          toIso6391Language(process.env.NEXT_PUBLIC_ASR_LANGUAGE ?? "en-US"),
        sample_rate,
        instructions: DEFAULT_HUMAN_AGENT_INSTRUCTIONS,
      },
      greeting_message: "Hello, how can I help?",
      failure_message: "Sorry, I encountered an issue. Please try again.",
      input_modalities: ["audio"],
      output_modalities: ["text", "audio"],
      turn_detection,
    };
  }

  return {
    url:
      process.env.NEXT_PUBLIC_OPENAI_MLLM_URL ??
      "wss://api.openai.com/v1/realtime",
    params: {
      model: process.env.NEXT_PUBLIC_OPENAI_MLLM_MODEL ?? "gpt-realtime",
      voice: process.env.NEXT_PUBLIC_OPENAI_MLLM_VOICE ?? "coral",
      instructions: DEFAULT_HUMAN_AGENT_INSTRUCTIONS,
      input_audio_transcription: getDefaultOpenAiInputAudioTranscription(),
    },
    greeting_message: "Hello! How can I help you today?",
    failure_message: "I'm sorry, something went wrong. Please try again.",
    input_modalities: ["audio", "text"],
    output_modalities: ["text", "audio"],
    turn_detection,
  };
}

export function getDefaultMllmVendor(): MllmEnvStyle {
  const v = (process.env.NEXT_PUBLIC_MLLM_VENDOR ?? "openai").trim();
  if (v === "gemini") return "gemini";
  if (v === "xai") return "xai";
  return "openai";
}

/** Full default `mllm` block for agent settings. */
export function getDefaultMllmSettings(
  style?: MllmEnvStyle,
): NonNullable<MllmConfig> {
  const vendor = style ?? getDefaultMllmVendor();
  const defaults = getMllmDefaultConfig(vendor);
  return {
    style: vendor,
    url: defaults.url,
    api_key: "",
    params: defaults.params,
    greeting_message: defaults.greeting_message,
    failure_message: defaults.failure_message,
    input_modalities: defaults.input_modalities,
    output_modalities: defaults.output_modalities,
    turn_detection: defaults.turn_detection,
  };
}

/** Resolve client or server MLLM API key for invite / join payloads. */
export function resolveMllmApiKeyForInvite(
  clientKey: string | undefined,
  style: MllmEnvStyle,
  shouldInjectServerKey: (v: string | undefined) => boolean,
): string {
  if (shouldInjectServerKey(clientKey)) {
    return getMllmApiKey(style);
  }
  return (clientKey ?? "").trim();
}

/** Build Agora `properties.mllm` object from agent settings. */
export function buildMllmInvitePayload(
  mllm: MllmConfig,
  shouldInjectServerKey: (v: string | undefined) => boolean,
): { style: MllmEnvStyle; apiKey: string; payload: Record<string, unknown> } {
  const style: MllmEnvStyle = mllm.style ?? "openai";
  const apiKey = resolveMllmApiKeyForInvite(
    mllm.api_key,
    style,
    shouldInjectServerKey,
  );

  const defaults = getMllmDefaultConfig(style);
  const mllmPayload: Record<string, unknown> = {
    enable: true,
    style,
    vendor: style,
  };

  const url = (mllm.url?.trim() || defaults.url).trim();
  if (url) mllmPayload.url = url;
  if (apiKey) mllmPayload.api_key = apiKey;

  if (mllm.headers) mllmPayload.headers = mllm.headers;

  const rawParams =
    mllm.params && Object.keys(mllm.params).length > 0
      ? (mllm.params as Record<string, unknown>)
      : defaults.params;
  const params =
    style === "openai"
      ? mergeOpenAiMllmParams(rawParams, defaults.params)
      : style === "xai"
        ? omitMllmInstructionsParam(rawParams)
        : rawParams;
  if (params && Object.keys(params).length > 0) {
    mllmPayload.params = params;
  }

  if (style === "xai") {
    const messages = getMllmSystemMessages(mllm, rawParams);
    if (messages && messages.length > 0) {
      mllmPayload.messages = messages;
    }
  }

  if (style !== "xai" && mllm.system_messages && mllm.system_messages.length > 0) {
    mllmPayload.system_messages = mllm.system_messages;
  }

  mllmPayload.greeting_message =
    mllm.greeting_message ?? defaults.greeting_message;
  mllmPayload.failure_message =
    mllm.failure_message ?? defaults.failure_message;

  if (mllm.max_history != null) {
    mllmPayload.max_history = mllm.max_history;
  }

  mllmPayload.input_modalities =
    mllm.input_modalities && mllm.input_modalities.length > 0
      ? mllm.input_modalities
      : defaults.input_modalities;
  mllmPayload.output_modalities =
    mllm.output_modalities && mllm.output_modalities.length > 0
      ? mllm.output_modalities
      : defaults.output_modalities;

  mllmPayload.turn_detection = normalizeMllmTurnDetectionForApi(
    mllm.turn_detection,
    style,
  );

  return { style, apiKey, payload: mllmPayload };
}
