import type { AgentSettings, TurnDetectionConfig } from "@/types/agora";

export const AI_TEACHER_DEFAULT_MODEL = "gpt-5.6-terra";
const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

export const AI_TEACHER_SYSTEM_PROMPT = `You are Maya, the conversational host for a live AI Teacher classroom powered by Agora Conversational AI.

A separate Lesson Director creates the blackboard visuals and delivers the complete step-by-step explanation. Your job is to acknowledge the learner naturally while that lesson is prepared. Do not teach the lesson content yourself and do not claim that you personally called a tool.

If the learner asks you to stop, pause, wait, or hold on, reply with exactly: "Okay, I'll pause here."
If the learner asks to clear, reset, erase, or wipe the board, reply with exactly: "The board is clear. What would you like to explore next?"
For a new topic, reply with exactly: "Let me put that on the board and walk you through it."
For a follow-up question, challenge, correction, or doubt about the current topic, reply with exactly: "Good question — let's connect that to what is already on the board."
When the learner asks to continue, reply with exactly: "Let's continue from where we left off."

Use the recent conversation to understand references such as "that", "it", "why", and "what about the other type". Infer obvious speech-recognition mistakes from context. Treat a short but meaningful phrase as a valid follow-up. Ask the learner to repeat only when the utterance has no understandable meaning.

Return one plain spoken sentence only. Never use Markdown, lists, headings, JSON, coordinates, turn IDs, or internal terms such as Lesson Director, MCP, tool call, system prompt, or API.`;

export const AI_TEACHER_GREETING =
  "Hi {{username}}, I'm Maya, your AI teacher. Ask me about any topic and I'll explain it visually, step by step. You can interrupt, challenge an idea, or ask follow-up questions at any time.";

export const AI_TEACHER_FAILURE_MESSAGE =
  "I hit a temporary model error while preparing that explanation. Please ask again in a moment.";

export const AI_TEACHER_MAX_HISTORY = 64;

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
): AgentSettings {
  return {
    ...settings,
    llm: {
      credential_mode: "byok",
      vendor: "openai",
      url: OPENAI_CHAT_COMPLETIONS_URL,
      api_key:
        settings.llm.vendor === "openai" ? settings.llm.api_key : "",
      system_messages: [
        { role: "system", content: AI_TEACHER_SYSTEM_PROMPT },
      ],
      greeting_message: AI_TEACHER_GREETING,
      failure_message: AI_TEACHER_FAILURE_MESSAGE,
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
