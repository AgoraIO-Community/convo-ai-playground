// src/types/agora.ts

import type { ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";

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
  | "custom";

// --- MCP (Model Context Protocol) Server ---
/** Transport protocol for MCP; Agora docs document streamable_http */
export type MCPTransport = "sse" | "http" | "streamable_http";

export interface MCPServerConfig {
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
}

export interface LLMConfig {
  /** LLM API endpoint URL (required) */
  url: string;
  /** API key for authentication (required) */
  api_key: string;
  /** Custom headers as JSON string (e.g., for Anthropic) */
  headers?: string;
  /** System messages for context */
  system_messages?: Array<{ role: string; content: string }>;
  /** Initial greeting when agent starts */
  greeting_message?: string;
  /** Greeting broadcast mode (v2.2+). When omitted, server defaults to single_every. */
  greeting_configs?: LLMGreetingConfigs;
  /** Fallback message on failure */
  failure_message?: string;
  /** Number of conversation history messages (1-1024, default 32) */
  max_history?: number;
  /** LLM style: "openai" or "anthropic" */
  style?: "openai" | "anthropic";
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
  | "microsoft"
  | "elevenlabs"
  | "minimax"
  | "cartesia"
  | "openai"
  | "fish_audio"
  | "google"
  | "polly"
  | "deepgram";

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
 * Deepgram TTS params (v2.6+ — see release notes).
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
  /** TTS vendor (required) */
  vendor: TTSVendor;
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
  | "microsoft"
  | "deepgram"
  | "openai"
  | "google"
  | "speechmatics"
  | "assemblyai"
  | "transcribe";

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

export interface ASRConfig {
  /** ASR vendor (default: ares) */
  vendor?: ASRVendor;
  /** Language code (BCP-47, e.g., en-US) */
  language?: string;
  /** Vendor-specific parameters */
  params?: ASRMicrosoftParams | ASRDeepgramParams | Record<string, unknown>;
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

export interface TurnDetectionStartOfSpeech {
  mode: TurnDetectionStartOfSpeechMode;
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
}

export type TurnDetectionEndOfSpeechMode = "vad" | "semantic";

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
  /** Enable MLLM (Multimodal LLM) for voice-to-voice */
  enable_mllm?: boolean;
}

// --- Agent Parameters ---
export interface AgentParametersConfig {
  /** Enable farewell detection */
  enable_farewell?: boolean;
  /** Custom farewell phrases */
  farewell_phrases?: string[];
  /** Data channel mode: "rtc" for RTC stream, "rtm" for RTM signaling */
  data_channel?: "rtc" | "rtm";
}

// --- MLLM (Multimodal LLM, voice-to-voice) ---
/** MLLM provider style. v2.6 introduces vendor-specific MLLM turn detection. */
export type MllmStyle = "openai" | "gemini" | "xai";

/** MLLM turn detection mode (Agora join API — inside `mllm.turn_detection`). */
export type MllmTurnDetectionMode =
  | "server_vad"
  | "agora_vad"
  | "semantic_vad";

/** Agora-documented MLLM turn detection (replaces top-level `turn_detection` when MLLM is on). */
export interface MllmTurnDetection {
  mode?: MllmTurnDetectionMode;
  server_vad_config?: {
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
    threshold?: number;
    idle_timeout_ms?: number;
    start_of_speech_sensitivity?: string;
    end_of_speech_sensitivity?: string;
  };
  agora_vad_config?: {
    interrupt_duration_ms?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
    threshold?: number;
  };
  semantic_vad_config?: {
    eagerness?: "auto" | "low" | "medium" | "high";
  };
  /** @deprecated Legacy shape — normalized on invite when `mode` is absent. */
  provider?: "openai" | "gemini" | "xai";
  openai?: Record<string, unknown>;
  gemini?: Record<string, unknown>;
}

/** MLLM (voice-to-voice) configuration. */
export interface MllmConfig {
  /** MLLM provider style (openai, gemini, or xai for xAI Grok Realtime). */
  style?: MllmStyle;
  /** API endpoint URL */
  url?: string;
  /** API key for authentication */
  api_key?: string;
  /** Custom headers as JSON string */
  headers?: string;
  /** Provider-specific parameters (model, voice, temperature, etc.) */
  params?: Record<string, unknown>;
  /** MLLM conversation messages, used by providers such as xAI Grok for system context */
  messages?: Array<{ role: string; content: string }>;
  /** System messages for context */
  system_messages?: Array<{ role: string; content: string }>;
  /** Greeting message */
  greeting_message?: string;
  /** Failure message */
  failure_message?: string;
  /** Conversation history depth */
  max_history?: number;
  /**
   * MLLM turn detection — refactored in v2.6 for clearer vendor-specific control
   * across OpenAI Realtime, Google Gemini Live, and xAI Grok.
   */
  turn_detection?: MllmTurnDetection;
  /** Allowed input modalities */
  input_modalities?: ("text" | "image" | "audio")[];
  /** Allowed output modalities */
  output_modalities?: ("text" | "audio")[];
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
  /** Action when agent is listening. Default: "inject". */
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
export type AvatarVendor = "akool" | "heygen" | "anam";

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

export interface AvatarConfig {
  enable: boolean;
  vendor: AvatarVendor;
  params: AvatarAkoolParams | AvatarHeyGenParams | AvatarAnamParams;
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
  // Agent name (required, unique identifier)
  name: string;

  // LLM Configuration (required)
  llm: LLMConfig;

  // MLLM Configuration (optional; used when advanced_features.enable_mllm = true).
  // v2.6 cleaner turn handling lives under mllm.turn_detection.
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
  style?: "openai" | "anthropic";
  headers?: string;
}

export const LLM_PRESETS: Record<LLMVendor, VendorPreset> = {
  openai: {
    label: "OpenAI",
    value: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
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
    defaultModel: "claude-3-5-sonnet-latest",
    models: [
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
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    requiresApiKey: true,
    style: "openai",
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
    style: "openai",
  },
  minimax: {
    label: "MiniMax",
    value: "minimax",
    url: "",
    defaultModel: "",
    requiresApiKey: true,
    style: "openai",
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
  deepgram: {
    label: "Deepgram (v2.6)",
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
};

export const ASR_PRESETS: Record<ASRVendor, VendorPreset> = {
  ares: {
    label: "Agora ARES (Built-in)",
    value: "ares",
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
 * Defines the structure for local audio and video tracks managed by Agora RTC.
 * These tracks represent the media streams captured from the user's microphone and camera.
 */
export interface LocalAgoraTracks {
  audioTrack: ILocalAudioTrack | null;
  videoTrack: ILocalVideoTrack | null;
}

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

/**
 * Defines the structure for a participant in the video call.
 * This interface is primarily used within your Zustand store (`remoteParticipants`)
 * to maintain the UI-relevant state of each user (local and remote).
 * Data for remote participants is often synchronized via Agora RTM attributes.
 */
export interface Participant {
  /**
   * The display name of the participant (e.g., entered by the user).
   * Synchronized via RTM.
   */
  name: string;

  /**
   * Boolean indicating if the participant's microphone is currently muted.
   * `true` means muted, `false` means unmuted. Synchronized via RTM.
   */
  micMuted: boolean;

  /**
   * Boolean indicating if the participant's video is currently off/disabled.
   * `true` means video is off, `false` means video is on. Synchronized via RTM.
   */
  videoMuted: boolean;
}

/**
 * Defines the structure of the response received from your Agora Managed Services backend
 * when creating or joining a meeting. This response contains all necessary tokens and IDs
 * to initialize Agora RTC and RTM clients, and to manage screen sharing.
 */

/**
 * Host control message types for RTM User Channel (private messages)
 */
export type HostControlMessageType =
  | "host-mute-request"
  | "host-unmute-request";

/**
 * Message payload for host mute/unmute requests
 * Sent via RTM User Channel (private, to specific user)
 */
export interface HostControlMessage {
  type: HostControlMessageType;
  fromUid: string;
  fromName: string;
  targetUid: string;
  mediaType: "audio" | "video" | "both";
  timestamp: number;
}

/**
 * Pending unmute request shown in consent modal
 */
export interface PendingUnmuteRequest {
  fromUid: string;
  fromName: string;
  mediaType: "audio" | "video" | "both";
  timestamp: number;
}

export interface MeetingResponse {
  /**
   * The unique ID of the Agora channel/meeting.
   * (Previously 'channelId' in interface, now matches backend 'channel' key)
   */
  channel: string;

  /**
   * The display title/name of the meeting.
   */
  title: string;

  /**
   * Indicates if the joined user is designated as a host.
   */
  isHost: boolean;

  /**
   * A secret string, likely for internal use or backend validation.
   */
  secret: string;

  /**
   * A salt for the secret, likely for internal use or backend validation.
   */
  secretSalt: string;

  /**
   * Details regarding the main user's tokens and UID for RTC and RTM.
   * These are now nested within a 'mainUser' object.
   */
  mainUser: {
    /**
     * The RTC token required for the main user.
     */
    rtc: string;
    /**
     * The RTM token required for the main user.
     */
    rtm: string;
    /**
     * The UID (User ID) assigned to the main user.
     */
    uid: string;
  };

  /**
   * Details regarding the screen sharing setup, including a dedicated RTC token and UID
   * for the screen sharing stream.
   */
  screenShare: {
    /**
     * The RTC token specifically for the screen sharing stream.
     */
    rtc: string;
    /**
     * The RTM token for screen sharing (can be null if not provided/used).
     * Added 'null' to the type.
     */
    rtm: string | null;
    /**
     * The UID for the screen sharing stream.
     * Type changed from string to number.
     */
    uid: number;
  };

  /**
   * The passphrase specifically for host access to the meeting.
   * (Still optional, as it's typically only present when a meeting is created).
   */
  hostPassphrase?: string;

  /**
   * The passphrase specifically for attendee/viewer access to the meeting.
   * (Still optional, as it's typically only present when a meeting is created).
   */
  viewerPassphrase?: string;

  /**
   * Whiteboard credentials returned from the join channel response.
   * Contains room token, UUID, appIdentifier, and region needed to join the interactive whiteboard.
   */
  whiteboard?: {
    room_token: string;
    room_uuid: string;
    appIdentifier?: string;
    region?: string;
  };
}
