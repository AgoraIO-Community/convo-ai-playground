// src/types/agora.ts

import {
  OPENAI_BYOK_DEFAULT_MODEL,
  OPENAI_BYOK_MODEL_IDS,
} from "@/lib/agora/openAIModels";

// ============================================
// CONVERSATIONAL AI AGENT SETTINGS
// Based on: https://docs.agora.io/en/conversational-ai/rest-api/agent/join
// ============================================

// --- LLM Vendors ---
export type LLMVendor =
  | "openai"
  | "azure_openai"
  | "anthropic"
  | "gemini"
  | "groq"
  | "coze"
  | "dify"
  | "minimax"
  | "xai"
  | "amazon_bedrock"
  | "google_vertex_ai"
  | "custom";

export type CredentialMode = "managed" | "byok";
export type LLMEngineVendor = "openai" | "azure" | "xai" | "custom";

// --- MCP (Model Context Protocol) Server ---
/** Transport protocol for MCP; Agora docs document streamable_http */
export type MCPTransport = "streamable_http" | "sse" | "http";

export interface MCPServerConfig {
  [key: string]: unknown;
  /** Unique identifier for the MCP server (max 48 chars, letters/numbers) */
  name: string;
  /** Endpoint URL of the MCP server */
  endpoint: string;
  /** Transport type; map to streamable_http for API when needed */
  transport?: MCPTransport;
  /** HTTP headers (e.g. Authorization) */
  headers?: Record<string, string>;
  /** Query params; merged into endpoint when building API payload */
  queries?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout_ms?: number;
  /** Tool names the agent is allowed to invoke; omit = all, [] = none */
  allowed_tools?: string[];
  /** UI-only: whether this server is enabled and included in the payload (default false) */
  enabled?: boolean;
}

/** UI-only: tool info from discovery (e.g. Refresh Tools) */
export interface MCPToolInfo {
  name: string;
  description?: string;
}

/**
 * Greeting broadcast configuration (v2.2+).
 * - `single_every`: Greeting plays every time a new user joins an empty channel.
 * - `single_first`: Greeting plays only the first time a user joins.
 */
export interface LLMGreetingConfigs {
  mode?: "single_every" | "single_first";
  delay_ms?: number;
  interruptable?: boolean;
  audio_download_timeout_ms?: number;
  audio_pcm_sample_rate?: 16000 | 24000;
}

export interface LLMConfig {
  /** Agora-managed provider credentials or bring-your-own-key. */
  credential_mode?: CredentialMode;
  /** Engine provider protocol. UI presets remain separate from this field. */
  vendor?: LLMEngineVendor;
  /** LLM API endpoint URL (required) */
  url: string;
  /** API key for authentication (required) */
  api_key: string;
  /** Amazon Bedrock API key (distinct from the AWS signing credentials). */
  access_key?: string;
  /** AWS access-key secret used by the Bedrock adapter. */
  secret_key?: string;
  /** AWS region used by the Bedrock adapter. */
  region?: string;
  /** Bedrock model identifier; Agora expects this at the LLM root. */
  model?: string;
  /** UI-only metadata used to edit provider-specific configuration. */
  provider_config?: {
    provider: "amazon_bedrock" | "google_vertex_ai";
    project_id?: string;
    location?: string;
  };
  /** Custom headers merged into LLM requests. */
  headers?: Record<string, string> | string;
  /** System messages for context */
  system_messages?: Array<{ role: string; content: string }>;
  /** Initial greeting when agent starts */
  greeting_message?: string;
  /** Publicly accessible greeting audio URL. */
  greeting_audio_url?: string;
  /** Greeting broadcast mode (v2.2+). When omitted, server defaults to single_every. */
  greeting_configs?: LLMGreetingConfigs;
  /** Fallback message on failure */
  failure_message?: string;
  /** Number of conversation history messages (1-1024, default 32) */
  max_history?: number;
  /** Request style supported by the current engine. */
  style?: "openai" | "gemini" | "anthropic" | "dify" | "bedrock";
  /** Model-specific parameters */
  params?: {
    model: string;
    max_tokens?: number;
    temperature?: number;
    [key: string]: unknown;
  };
  /** MCP server configurations for tool invocation */
  mcp_servers?: MCPServerConfig[];
  /** LLM input modalities: text only or text + image (default when omitted: ["text", "image"]) */
  input_modalities?: ("text" | "image")[];
  /**
   * LLM output modalities (v2.x). When omitted, server defaults to ["text"].
   * - `["text"]`: TTS module converts text to speech.
   * - `["audio"]`: Voice published directly (LLM produces speech).
   * - `["text","audio"]`: Both — caller handles processing.
   */
  output_modalities?: ("text" | "audio")[];
  /** Template variables for dynamic content */
  template_variables?: Record<string, unknown>;
}

// --- TTS Vendors ---
export type TTSVendor =
  | "amazon"
  | "cartesia"
  | "deepgram"
  | "elevenlabs"
  | "fishaudio"
  | "generic_http"
  | "google"
  | "gradium"
  | "humeai"
  | "microsoft"
  | "minimax"
  | "mistral"
  | "murf"
  | "openai"
  | "rime"
  | "sarvam"
  | "typecast"
  | "xai"
  /** @deprecated Saved-settings alias; migrated to fishaudio. */
  | "fish_audio"
  /** @deprecated Saved-settings alias; migrated to amazon. */
  | "polly";

export type TTSApiVendor =
  | "amazon"
  | "cartesia"
  | "deepgram"
  | "elevenlabs"
  | "fishaudio"
  | "generic_http"
  | "google"
  | "gradium"
  | "humeai"
  | "microsoft"
  | "minimax"
  | "mistral"
  | "murf"
  | "openai"
  | "rime"
  | "sarvam"
  | "typecast"
  | "xai";

export interface TTSMicrosoftParams {
  key: string;
  region: string;
  voice_name: string;
  speed?: number;
  volume?: number;
  sample_rate?: number;
}

export interface TTSElevenLabsParams {
  base_url?: string;
  key: string;
  model_id: string;
  voice_id: string;
  sample_rate?: number;
  speed?: number;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface TTSOpenAIParams {
  key: string;
  model: string;
  voice: string;
  speed?: number;
}

/**
 * Deepgram TTS params supported by the current engine.
 * Adds streaming-friendly TTS via Deepgram's Aura family of models.
 */
export interface TTSDeepgramParams {
  key: string;
  /** Optional override of Deepgram TTS endpoint base URL */
  url?: string;
  /** Voice/model identifier (e.g. "aura-asteria-en", "aura-luna-en") */
  model?: string;
  /** Output sample rate; align with avatar/voice pipeline if used */
  sample_rate?: number;
  /** Encoding format (e.g. "linear16", "mulaw") */
  encoding?: string;
}

export interface TTSConfig {
  credential_mode?: CredentialMode;
  /** TTS vendor (required) */
  vendor: TTSVendor | TTSApiVendor;
  /** OpenAI-compatible endpoint for generic_http. */
  url?: string;
  /** Request headers for generic_http. */
  headers?: Record<string, string>;
  /** Pattern identifiers omitted from synthesized speech. */
  skip_patterns?: number[];
  /** Vendor-specific parameters */
  params:
    | TTSMicrosoftParams
    | TTSElevenLabsParams
    | TTSOpenAIParams
    | TTSDeepgramParams
    | Record<string, unknown>;
}

// --- ASR (STT) Vendors ---
export type ASRVendor =
  | "ares"
  | "fengming"
  | "microsoft"
  | "deepgram"
  | "gemini"
  | "openai"
  | "google"
  | "speechmatics"
  | "assemblyai"
  | "amazon"
  | "sarvam"
  | "xai"
  /** @deprecated Saved-settings alias; migrated to amazon. */
  | "transcribe";

export type ASRApiVendor =
  | "ares"
  | "fengming"
  | "microsoft"
  | "deepgram"
  | "gemini"
  | "openai"
  | "google"
  | "speechmatics"
  | "assemblyai"
  | "amazon"
  | "sarvam"
  | "xai";

export interface ASRMicrosoftParams {
  key: string;
  region: string;
  language: string;
  phrase_list?: string[];
}

export interface ASRDeepgramParams {
  key: string;
  url?: string;
  model?: string;
  language?: string;
  keyterm?: string;
}

export interface ASRGeminiParams {
  api_key: string;
  model: "gemini-3.5-transcribe-live";
  sample_rate: number;
  language: string;
  word_timestamp: boolean;
}

export interface ASRConfig {
  credential_mode?: CredentialMode;
  /** ASR vendor (default: ares) */
  vendor?: ASRVendor | ASRApiVendor;
  /** Language code (BCP-47, e.g., en-US) */
  language?: string;
  /** v2.11 ARES keyword boosting; maximum 128 entries. */
  keywords?: string[];
  /** Vendor-specific parameters */
  params?:
    | ASRMicrosoftParams
    | ASRDeepgramParams
    | ASRGeminiParams
    | Record<string, unknown>;
}

// --- Turn Detection (Agora join API v2 config format) ---
/** VAD-based start-of-speech config */
export interface TurnDetectionVadConfig {
  interrupt_duration_ms?: number;
  speaking_interrupt_duration_ms?: number;
  prefix_padding_ms?: number;
}

/** Keyword-trigger start-of-speech config */
export interface TurnDetectionKeywordsConfig {
  interrupt_duration_ms?: number;
  prefix_padding_ms?: number;
  triggered_keywords?: string[];
}

/** Disabled start-of-speech config */
export interface TurnDetectionDisabledConfig {
  strategy?: "append" | "ignored";
}

export type TurnDetectionStartOfSpeechMode = "vad" | "keywords" | "disabled";
export type CurrentTurnDetectionStartOfSpeechMode = "vad" | "manual";

export interface TurnDetectionStartOfSpeech {
  mode: TurnDetectionStartOfSpeechMode | CurrentTurnDetectionStartOfSpeechMode;
  vad_config?: TurnDetectionVadConfig;
  keywords_config?: TurnDetectionKeywordsConfig;
  disabled_config?: TurnDetectionDisabledConfig;
}

/** End-of-speech VAD config */
export interface TurnDetectionEndOfSpeechVadConfig {
  silence_duration_ms?: number;
}

/** End-of-speech semantic config */
export interface TurnDetectionEndOfSpeechSemanticConfig {
  silence_duration_ms?: number;
  max_wait_ms?: number;
  pause_state_enabled?: boolean;
}

export type TurnDetectionEndOfSpeechMode = "vad" | "semantic" | "manual";

export interface TurnDetectionEndOfSpeech {
  mode: TurnDetectionEndOfSpeechMode;
  vad_config?: TurnDetectionEndOfSpeechVadConfig;
  semantic_config?: TurnDetectionEndOfSpeechSemanticConfig;
}

export interface TurnDetectionConfigConfig {
  /** Voice activity detection sensitivity (0.0–1.0, default 0.5) */
  speech_threshold?: number;
  start_of_speech?: TurnDetectionStartOfSpeech;
  end_of_speech?: TurnDetectionEndOfSpeech;
}

export interface TurnDetectionConfig {
  /** Conversation turn detection mode (default: "default") */
  mode?: "default";
  /** Detailed configuration for conversation turn detection */
  config?: TurnDetectionConfigConfig;
}

export interface InterruptionKeywordsConfig {
  trigger_keywords?: string[];
}

export interface InterruptionConfig {
  enable?: boolean;
  mode?: "start_of_speech" | "keywords";
  keywords_config?: InterruptionKeywordsConfig;
  disabled_config?: { strategy?: "append" | "ignore" };
}

// --- Filler Words ---
export interface FillerWordsTriggerConfig {
  mode: "fixed_time";
  fixed_time_config?: { response_wait_ms?: number };
}

export interface FillerWordsContentConfig {
  mode: "static";
  static_config?: {
    phrases?: string[];
    selection_rule?: "shuffle" | "round_robin";
  };
}

export interface FillerWordsConfig {
  /** Whether to enable filler words (default false) */
  enable?: boolean;
  trigger?: FillerWordsTriggerConfig;
  content?: FillerWordsContentConfig;
}

// --- SAL (Selective Attention Locking) ---
export interface SalConfig {
  /** locking | recognition (default "locking") */
  sal_mode?: "locking" | "recognition";
  /** Voiceprint name → download URL (e.g. { "speaker1": "https://..." }) */
  sample_urls?: Record<string, string>;
}

// --- Advanced Features ---
export interface AdvancedFeaturesConfig {
  /** Enable RTM messaging */
  enable_rtm?: boolean;
  /** Enable Selective Attention Locking (SAL). When enabled, configure the sal field for speaker recognition or locking modes. Default: false */
  enable_sal?: boolean;
  /** Enable function calling / tools */
  enable_tools?: boolean;
  /** @deprecated Use mllm.enable. Retained only while migrating saved settings. */
  enable_mllm?: boolean;
}

// --- Agent Parameters ---
export interface AgentParametersConfig {
  /** @deprecated Use farewell_config.graceful_enabled. */
  enable_farewell?: boolean;
  /** @deprecated No current v2.11 equivalent. */
  farewell_phrases?: string[];
  data_channel?: "datastream" | "rtm" | "rtc";
  enable_metrics?: boolean;
  enable_error_message?: boolean;
  audio_scenario?: "default" | "chorus" | "aiserver";
  opt_out?: boolean;
  silence_config?: {
    action?: "speak" | "think" | "none";
    timeout_ms?: number;
    content?: string;
  };
  farewell_config?: {
    graceful_enabled?: boolean;
    graceful_timeout_seconds?: number;
  };
}

// --- MLLM (Multimodal LLM, voice-to-voice) ---
/** Legacy MLLM provider style retained only for saved-settings migration. */
export type MllmStyle = "openai" | "gemini";
export type MllmVendor = "openai" | "azure" | "gemini" | "vertexai" | "xai";

/** Current vendor-specific MLLM turn detection. */
export interface MllmTurnDetection {
  mode?: "agora_vad" | "server_vad" | "semantic_vad";
  agora_vad_config?: Record<string, unknown>;
  server_vad_config?: Record<string, unknown>;
  semantic_vad_config?: Record<string, unknown>;
  /**
   * Provider for MLLM turn detection.
   * - `openai`: OpenAI Realtime server VAD / semantic VAD config.
   * - `gemini`: Google Gemini Live activity-detection config.
   */
  provider?: "openai" | "gemini";
  /** OpenAI Realtime server_vad / semantic_vad config (passed through verbatim). */
  openai?: Record<string, unknown>;
  /** Google Gemini Live realtime_input_config / activity_detection config (passed through verbatim). */
  gemini?: Record<string, unknown>;
}

/** MLLM (voice-to-voice) configuration. */
export interface MllmConfig {
  enable?: boolean;
  vendor?: MllmVendor;
  /** @deprecated Use vendor. Retained only while migrating saved settings. */
  style?: MllmStyle;
  /** API endpoint URL */
  url?: string;
  /** API key for authentication */
  api_key?: string;
  /** @deprecated Not part of the current REST MLLM contract. */
  headers?: string;
  /** Provider-specific parameters (model, voice, temperature, etc.) */
  params?: Record<string, unknown>;
  /** Current short-term memory items (OpenAI Realtime item structure). */
  messages?: Record<string, unknown>[];
  /** @deprecated Migrated to messages. */
  system_messages?: Array<{ role: string; content: string }>;
  /** Greeting message */
  greeting_message?: string;
  /** @deprecated Not part of the current REST MLLM contract. */
  failure_message?: string;
  /** @deprecated Not part of the current REST MLLM contract. */
  max_history?: number;
  /**
   * Current MLLM turn detection across supported realtime providers.
   */
  turn_detection?: MllmTurnDetection;
  /** Allowed input modalities */
  input_modalities?: ("audio" | "text")[];
  /** Current MLLM output is text plus audio. */
  output_modalities?: ["text", "audio"];
}

export type GeofenceArea =
  | "GLOBAL"
  | "NORTH_AMERICA"
  | "EUROPE"
  | "ASIA"
  | "INDIA"
  | "JAPAN";

export interface GeofenceConfig {
  area: GeofenceArea;
  exclude_area?: Exclude<GeofenceArea, "GLOBAL">;
}

// --- /think endpoint (v2.6) ---
/** Action to take when the agent is in a given state. */
export type ThinkActionInjectIgnore = "inject" | "ignore";
export type ThinkActionInterruptIgnore = "interrupt" | "ignore";

/**
 * Options for sending a custom instruction to a running agent.
 * POST /v2/projects/{appid}/agents/{agentId}/think
 *
 * The instruction is injected into the agent's pipeline as user input
 * and processed using the standard turn logic.
 */
export interface ThinkOptions {
  /** The custom instruction text to inject (required). */
  text: string;
  /** Action when agent is listening. Engine v2.7+ default: "interrupt". */
  on_listening_action?: ThinkActionInjectIgnore;
  /** Action when agent is thinking. Default: "interrupt". */
  on_thinking_action?: ThinkActionInterruptIgnore;
  /** Action when agent is speaking. Default: "ignore". */
  on_speaking_action?: ThinkActionInterruptIgnore;
  /** Whether user speech can interrupt the injected instruction. Default: true. */
  interruptable?: boolean;
  /** Custom metadata; passes through verbatim. */
  metadata?: Record<string, unknown>;
  /** UI-only: human-readable label captured in the local instruction log. */
  label?: string;
}

/** Response from /think endpoint. */
export interface ThinkResponse {
  agent_id: string;
  channel: string;
  start_ts: number;
}

// --- Avatar Vendors ---
export type AvatarVendor = "akool" | "heygen" | "anam" | "lemonslice";

export interface AvatarAkoolParams {
  api_key: string;
  agora_uid: string;
  agora_token?: string;
  avatar_id: string;
}

export interface AvatarHeyGenParams {
  api_key: string;
  quality: "low" | "medium" | "high";
  agora_uid: string;
  agora_token?: string;
  avatar_id?: string;
  disable_idle_timeout?: boolean;
  activity_idle_timeout?: number;
}

export interface AvatarAnamParams {
  api_key: string;
  agora_uid: string;
  agora_token?: string;
  avatar_id: string;
  /** Hz — Agora docs: 16000, 24000, or 48000. Default 24000. */
  sample_rate?: 16000 | 24000 | 48000;
  quality?: "high" | "medium" | "low";
  video_encoding?: "H264" | "AV1";
}

export interface AvatarLemonSliceParams {
  api_key: string;
  agora_uid: string;
  agora_token?: string;
  /** Publicly accessible portrait image URL. */
  avatar_id: string;
  api_base_url: string;
  /** Hz — LemonSlice requires 24 kHz by default. */
  sample_rate?: 16000 | 24000 | 48000;
  quality?: "high" | "medium" | "low";
  version?: string;
  video_encoding?: "H264" | "AV1";
  activity_idle_timeout?: number;
  area?: string;
}

export interface AvatarConfig {
  enable: boolean;
  vendor: AvatarVendor;
  params:
    | AvatarAkoolParams
    | AvatarHeyGenParams
    | AvatarAnamParams
    | AvatarLemonSliceParams;
}

// --- Agent Query Status (from Agora REST API: GET /agents/{agentId}) ---
export type AgentOperationalStatus =
  | "IDLE"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "STOPPED"
  | "RECOVERING"
  | "FAILED";

export interface AgentQueryStatus {
  message: string;
  start_ts: number;
  stop_ts: number;
  status: AgentOperationalStatus;
  agent_id: string;
}

// --- Agent State Enum (from Agora Conversational AI API) ---
export enum EAgentState {
  IDLE = "idle",
  LISTENING = "listening",
  THINKING = "thinking",
  SPEAKING = "speaking",
  SILENT = "silent",
}

// --- Transcript Types ---
export enum ETurnStatus {
  IN_PROGRESS = 0,
  END = 1,
  INTERRUPTED = 2,
}

// --- Transcript Render Mode ---
export enum ETranscriptRenderMode {
  TEXT = "text", // Show full text block at once
  WORD = "word", // Animate word-by-word using timing data
  AUTO = "auto", // Auto-detect based on available data
}

export interface ITranscriptHelperItem<T = unknown> {
  uid: string;
  stream_id: number;
  turn_id: number;
  _time: number;
  text: string;
  status: ETurnStatus;
  metadata: T | null;
}

export interface IUserTranscription {
  object: "user.transcription";
  text: string;
  start_ms: number;
  duration_ms: number;
  language: string;
  turn_id: number;
  stream_id: number;
  user_id: string;
  words: Array<{
    word: string;
    start_ms: number;
    duration_ms: number;
    stable: boolean;
  }> | null;
  final: boolean;
}

export interface IAgentTranscription {
  object: "assistant.transcription";
  text: string;
  start_ms: number;
  duration_ms: number;
  language: string;
  turn_id: number;
  stream_id: number;
  user_id: string;
  words: Array<{
    word: string;
    start_ms: number;
    duration_ms: number;
    stable: boolean;
  }> | null;
  quiet: boolean;
  turn_seq_id: number;
  turn_status: ETurnStatus;
}

// --- Complete Agent Settings (used for UI) ---
export interface AgentSettings {
  /** Local persisted-settings schema version; never sent to Agora. */
  schemaVersion?: number;
  /** Upstream Conversational AI REST base used by the application API routes. */
  api_base_url?: string;
  // Agent name (required, unique identifier)
  name: string;

  /** Optional published Studio pipeline used as the base configuration. */
  pipeline_id?: string;

  /** Restricts the regions the engine can access. */
  geofence?: GeofenceConfig;

  // LLM Configuration (required)
  llm: LLMConfig;

  // MLLM Configuration (optional; used when mllm.enable = true).
  mllm?: MllmConfig;

  // TTS Configuration (required)
  tts: TTSConfig;

  // ASR Configuration (optional, defaults to ares)
  asr?: ASRConfig;

  // Idle timeout in seconds (default 30)
  idle_timeout?: number;

  /** When true, turn_detection is sent in the join payload; when false, it is omitted so user can draft without applying. */
  enable_turn_detection?: boolean;

  // Turn detection settings (Agora v2 config format; only sent when enable_turn_detection is true)
  turn_detection?: TurnDetectionConfig;

  // Interruption strategy, separate from turn detection in the current API.
  interruption?: InterruptionConfig;

  // Filler words (played while waiting for LLM)
  filler_words?: FillerWordsConfig;

  // SAL config (only sent when advanced_features.enable_sal is true)
  sal?: SalConfig;

  // Advanced features
  advanced_features?: AdvancedFeaturesConfig;

  // Agent parameters
  parameters?: AgentParametersConfig;

  // Avatar configuration (optional)
  avatar?: AvatarConfig;
}

// --- Preset Configurations for Quick Setup ---
export interface VendorPreset {
  label: string;
  value: string;
  url?: string;
  defaultModel?: string;
  models?: string[];
  requiresApiKey: boolean;
  style?: "openai" | "gemini" | "anthropic" | "dify" | "bedrock";
  headers?: string;
}

export const LLM_PRESETS: Record<LLMVendor, VendorPreset> = {
  openai: {
    label: "OpenAI",
    value: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: OPENAI_BYOK_DEFAULT_MODEL,
    models: [...OPENAI_BYOK_MODEL_IDS],
    requiresApiKey: true,
    style: "openai",
  },
  azure_openai: {
    label: "Azure OpenAI",
    value: "azure_openai",
    url: "",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-35-turbo"],
    requiresApiKey: true,
    style: "openai",
  },
  anthropic: {
    label: "Anthropic Claude",
    value: "anthropic",
    url: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-sonnet-4-6",
    models: [
      "claude-sonnet-4-6",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-3-opus-latest",
    ],
    requiresApiKey: true,
    style: "anthropic",
    headers: '{"anthropic-version":"2023-06-01"}',
  },
  gemini: {
    label: "Google Gemini",
    value: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse",
    defaultModel: "gemini-3.6-flash",
    models: [
      "gemini-3.6-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
    requiresApiKey: true,
    style: "gemini",
  },
  groq: {
    label: "Groq",
    value: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768",
    ],
    requiresApiKey: true,
    style: "openai",
  },
  coze: {
    label: "Coze",
    value: "coze",
    url: "",
    defaultModel: "",
    requiresApiKey: true,
    style: "openai",
  },
  dify: {
    label: "Dify",
    value: "dify",
    url: "",
    defaultModel: "",
    requiresApiKey: true,
    style: "dify",
  },
  minimax: {
    label: "MiniMax",
    value: "minimax",
    url: "",
    defaultModel: "",
    requiresApiKey: true,
    style: "openai",
  },
  xai: {
    label: "xAI Grok",
    value: "xai",
    url: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4-latest",
    models: ["grok-4-latest", "grok-3-latest"],
    requiresApiKey: true,
    style: "openai",
  },
  amazon_bedrock: {
    label: "Amazon Bedrock",
    value: "amazon_bedrock",
    url: "https://bedrock-runtime.us-east-1.amazonaws.com/model/us.anthropic.claude-sonnet-4-20250514-v1:0/converse-stream",
    defaultModel: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    requiresApiKey: true,
    style: "bedrock",
  },
  google_vertex_ai: {
    label: "Google Vertex AI",
    value: "google_vertex_ai",
    url: "",
    defaultModel: "gemini-2.0-flash-001",
    requiresApiKey: true,
    style: "gemini",
  },
  custom: {
    label: "Custom (OpenAI-compatible)",
    value: "custom",
    url: "",
    defaultModel: "",
    requiresApiKey: false,
    style: "openai",
  },
};

export const TTS_PRESETS: Record<
  TTSVendor,
  VendorPreset & { voices?: string[] }
> = {
  microsoft: {
    label: "Microsoft Azure",
    value: "microsoft",
    requiresApiKey: true,
    voices: [
      "en-US-AndrewMultilingualNeural",
      "en-US-JennyNeural",
      "en-US-GuyNeural",
      "en-US-AriaNeural",
      "en-GB-SoniaNeural",
    ],
  },
  elevenlabs: {
    label: "ElevenLabs",
    value: "elevenlabs",
    requiresApiKey: true,
    defaultModel: "eleven_flash_v2_5",
    models: ["eleven_flash_v2_5", "eleven_multilingual_v2", "eleven_turbo_v2"],
  },
  openai: {
    label: "OpenAI TTS",
    value: "openai",
    requiresApiKey: true,
    defaultModel: "tts-1",
    models: ["tts-1", "tts-1-hd"],
    voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
  },
  minimax: {
    label: "MiniMax",
    value: "minimax",
    requiresApiKey: true,
  },
  cartesia: {
    label: "Cartesia (Beta)",
    value: "cartesia",
    requiresApiKey: true,
  },
  fish_audio: {
    label: "Fish Audio (Beta)",
    value: "fish_audio",
    requiresApiKey: true,
  },
  fishaudio: {
    label: "Fish Audio",
    value: "fishaudio",
    requiresApiKey: true,
  },
  google: {
    label: "Google TTS (Beta)",
    value: "google",
    requiresApiKey: true,
  },
  polly: {
    label: "Amazon Polly (Beta)",
    value: "polly",
    requiresApiKey: true,
  },
  amazon: {
    label: "Amazon Polly",
    value: "amazon",
    requiresApiKey: true,
  },
  deepgram: {
    label: "Deepgram",
    value: "deepgram",
    requiresApiKey: true,
    defaultModel: "aura-asteria-en",
    models: [
      "aura-asteria-en",
      "aura-luna-en",
      "aura-stella-en",
      "aura-athena-en",
      "aura-hera-en",
      "aura-orion-en",
      "aura-arcas-en",
      "aura-perseus-en",
      "aura-angus-en",
      "aura-orpheus-en",
      "aura-helios-en",
      "aura-zeus-en",
    ],
  },
  generic_http: {
    label: "Generic HTTP (v2.11)",
    value: "generic_http",
    requiresApiKey: false,
  },
  gradium: {
    label: "Gradium",
    value: "gradium",
    requiresApiKey: true,
  },
  humeai: {
    label: "Hume AI",
    value: "humeai",
    requiresApiKey: true,
  },
  mistral: {
    label: "Mistral",
    value: "mistral",
    requiresApiKey: true,
  },
  murf: {
    label: "Murf",
    value: "murf",
    requiresApiKey: true,
  },
  rime: {
    label: "Rime",
    value: "rime",
    requiresApiKey: true,
  },
  sarvam: {
    label: "Sarvam",
    value: "sarvam",
    requiresApiKey: true,
  },
  typecast: {
    label: "Typecast (v2.11)",
    value: "typecast",
    requiresApiKey: true,
  },
  xai: {
    label: "xAI",
    value: "xai",
    requiresApiKey: true,
  },
};

export const ASR_PRESETS: Record<ASRVendor, VendorPreset> = {
  ares: {
    label: "Agora ARES (Global built-in)",
    value: "ares",
    requiresApiKey: false,
  },
  fengming: {
    label: "Agora Fengming (China managed)",
    value: "fengming",
    requiresApiKey: false,
  },
  microsoft: {
    label: "Microsoft Azure",
    value: "microsoft",
    requiresApiKey: true,
  },
  deepgram: {
    label: "Deepgram",
    value: "deepgram",
    requiresApiKey: true,
    defaultModel: "nova-3",
    models: ["nova-3", "nova-2", "enhanced", "base"],
  },
  gemini: {
    label: "Google Gemini (Early Access)",
    value: "gemini",
    requiresApiKey: true,
    defaultModel: "gemini-3.5-transcribe-live",
    models: ["gemini-3.5-transcribe-live"],
  },
  openai: {
    label: "OpenAI Whisper (Beta)",
    value: "openai",
    requiresApiKey: true,
  },
  google: {
    label: "Google (Beta)",
    value: "google",
    requiresApiKey: true,
  },
  speechmatics: {
    label: "Speechmatics",
    value: "speechmatics",
    requiresApiKey: true,
  },
  assemblyai: {
    label: "AssemblyAI (Beta)",
    value: "assemblyai",
    requiresApiKey: true,
  },
  transcribe: {
    label: "Amazon Transcribe (Beta)",
    value: "transcribe",
    requiresApiKey: true,
  },
  amazon: {
    label: "Amazon Transcribe",
    value: "amazon",
    requiresApiKey: true,
  },
  sarvam: {
    label: "Sarvam",
    value: "sarvam",
    requiresApiKey: true,
  },
  xai: {
    label: "xAI",
    value: "xai",
    requiresApiKey: true,
  },
};

export const SUPPORTED_LANGUAGES = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "en-IN", label: "English (India)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "es-MX", label: "Spanish (Mexico)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "it-IT", label: "Italian" },
  { code: "pt-PT", label: "Portuguese" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "hi-IN", label: "Hindi" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "nl-NL", label: "Dutch" },
  { code: "tr-TR", label: "Turkish" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "th-TH", label: "Thai" },
  { code: "id-ID", label: "Indonesian" },
  { code: "ms-MY", label: "Malay" },
  { code: "fil-PH", label: "Filipino" },
];

/**
 * Represents an audio input device (microphone) for device selection.
 */
export interface AudioDevice {
  /** Unique identifier for the device */
  deviceId: string;
  /** Human-readable device name (only available after permission granted) */
  label: string;
  /** Device kind - always 'audioinput' for microphones */
  kind: "audioinput";
}

/**
 * Voice settings for microphone configuration.
 */
export interface VoiceSettings {
  /** Currently selected microphone device ID (null for system default) */
  selectedMicrophoneId: string | null;
  /** Whether a microphone test is currently in progress */
  testInProgress: boolean;
}
