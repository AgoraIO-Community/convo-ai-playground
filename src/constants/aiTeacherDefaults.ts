import { DEFAULT_TEACHER_LOCALE, getTeacherLocaleProfile, type TeacherLocale } from "@/locales";
import { enUS } from "@/locales/en-US";
export { AI_TEACHER_NAME } from "@/locales/shared";
import type { AgentSettings, TurnDetectionConfig } from "@/types/agora";

export const AI_TEACHER_DEFAULT_MODEL = "gpt-5.6-terra";
export const AI_TEACHER_DIRECTOR_DEFAULT_MODEL = "gpt-6-sol";
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

// English aliases keep the general saved-settings editor compatible.
export const AI_TEACHER_SYSTEM_PROMPT = enUS.agent.systemPrompt;
export const AI_TEACHER_GREETING = enUS.agent.greeting;
export const AI_TEACHER_FAILURE_MESSAGE = enUS.agent.failureMessage;

export const AI_TEACHER_MAX_HISTORY = 64;

export function getAiTeacherLearnerName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "Guest";
}

export const AI_TEACHER_AGENT_LLM_PARAMS = {
  model: AI_TEACHER_DEFAULT_MODEL,
  max_completion_tokens: 96,
  reasoning_effort: "none",
} as const;

export const AI_TEACHER_TURN_DETECTION: TurnDetectionConfig = {
  mode: "default",
  config: {
    speech_threshold: 0.45,
    start_of_speech: {
      mode: "vad",
      vad_config: {
        interrupt_duration_ms: 240,
        speaking_interrupt_duration_ms: 320,
        prefix_padding_ms: 800,
      },
    },
    end_of_speech: {
      mode: "vad",
      vad_config: { silence_duration_ms: 1000 },
    },
  },
};

export function withAiTeacherRuntimeDefaults(
  settings: AgentSettings,
  locale: TeacherLocale = DEFAULT_TEACHER_LOCALE,
): AgentSettings {
  const profile = getTeacherLocaleProfile(locale);
  const teacherAvatar =
    settings.avatar?.vendor === "lemonslice"
      ? {
          ...settings.avatar,
          params: {
            ...settings.avatar.params,
            aspect_ratio: "2x3" as const,
          },
        }
      : settings.avatar;

  return {
    ...settings,
    avatar: teacherAvatar,
    asr: {
      ...(settings.asr?.vendor === "deepgram" ? settings.asr : {}),
      credential_mode: "byok",
      vendor: "deepgram",
      language: profile.asr.language,
      params: {
        ...(settings.asr?.vendor === "deepgram" ? settings.asr.params : {}),
        model: profile.asr.model,
        language: profile.asr.language,
      },
    },
    llm: {
      credential_mode: "byok",
      vendor: "openai",
      url: OPENAI_CHAT_COMPLETIONS_URL,
      api_key:
        settings.llm.vendor === "openai" ? settings.llm.api_key : "",
      system_messages: [
        { role: "system", content: profile.agent.systemPrompt },
      ],
      greeting_message: profile.agent.greeting,
      failure_message: profile.agent.failureMessage,
      max_history: AI_TEACHER_MAX_HISTORY,
      style: "openai",
      params: { ...AI_TEACHER_AGENT_LLM_PARAMS },
      mcp_servers: settings.llm.mcp_servers,
    },
    mllm: settings.mllm
      ? {
          ...settings.mllm,
          enable: false,
        }
      : settings.mllm,
    enable_turn_detection: true,
    turn_detection: AI_TEACHER_TURN_DETECTION,
    interruption: {
      enable: true,
      mode: "start_of_speech",
      disabled_config: { strategy: "append" },
    },
    advanced_features: {
      ...settings.advanced_features,
      enable_rtm: true,
    },
    parameters: {
      ...settings.parameters,
      data_channel: "rtm",
      enable_metrics: true,
      enable_error_message: true,
    },
  };
}
