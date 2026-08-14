"use client";

import React, { useState, useEffect } from "react";
import {
  MdClose,
  MdExpandMore,
  MdExpandLess,
  MdRecordVoiceOver,
  MdGraphicEq,
  MdTune,
  MdFace,
} from "react-icons/md";
import useAppStore from "@/store/useAppStore";
import InfoTooltip from "@/components/common/InfoTooltip";
import type {
  AgentSettings,
  LLMVendor,
  TTSVendor,
  ASRVendor,
  AvatarVendor,
  LLMConfig,
  TTSConfig,
  ASRConfig,
  AvatarConfig,
  AvatarAkoolParams,
  AvatarHeyGenParams,
  AvatarAnamParams,
  AvatarLemonSliceParams,
  TurnDetectionConfig,
  FillerWordsConfig,
  SalConfig,
  TurnDetectionStartOfSpeechMode,
  TurnDetectionEndOfSpeechMode,
} from "@/types/agora";
import {
  LLM_PRESETS,
  TTS_PRESETS,
  ASR_PRESETS,
  SUPPORTED_LANGUAGES,
} from "@/types/agora";
import {
  HEYGEN_AVATAR_GROUPS,
  HEYGEN_DEFAULT_AVATAR_ID,
} from "@/constants/heygenAvatars";
import {
  ANAM_AVATAR_OPTIONS,
  ANAM_DEFAULT_AVATAR_ID,
} from "@/constants/anamAvatars";
import {
  LEMON_SLICE_DEFAULT_API_BASE_URL,
  LEMON_SLICE_DEFAULT_AREA,
  LEMON_SLICE_DEFAULT_AVATAR_ID,
  LEMON_SLICE_DEFAULT_QUALITY,
} from "@/constants/lemonSlice";
import ElevenLabsVoicePicker from "@/components/ElevenLabsVoicePicker";
import { ELEVENLABS_DEFAULT_VOICE_ID } from "@/constants/elevenlabsDefaults";

interface AgentSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: AgentSettings) => void;
}

// Section collapse state
type SectionKey = "llm" | "tts" | "asr" | "avatar" | "advanced";

// Environment variable helpers (no API keys; server injects them from server-only env vars)
const ENV_MAP: Record<string, string | undefined> = {
  LLM_VENDOR: process.env.NEXT_PUBLIC_LLM_VENDOR,
  TTS_VENDOR: process.env.NEXT_PUBLIC_TTS_VENDOR,
  ASR_VENDOR: process.env.NEXT_PUBLIC_ASR_VENDOR,
  LLM_URL: process.env.NEXT_PUBLIC_LLM_URL,
  LLM_MODEL: process.env.NEXT_PUBLIC_LLM_MODEL,
  MICROSOFT_TTS_REGION: process.env.NEXT_PUBLIC_MICROSOFT_TTS_REGION,
  MICROSOFT_TTS_VOICE: process.env.NEXT_PUBLIC_MICROSOFT_TTS_VOICE,
  ELEVENLABS_VOICE_ID: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID,
  ELEVENLABS_MODEL_ID: process.env.NEXT_PUBLIC_ELEVENLABS_MODEL_ID,
  ELEVENLABS_SAMPLE_RATE: process.env.NEXT_PUBLIC_ELEVENLABS_SAMPLE_RATE,
  OPENAI_TTS_MODEL: process.env.NEXT_PUBLIC_OPENAI_TTS_MODEL,
  OPENAI_TTS_VOICE: process.env.NEXT_PUBLIC_OPENAI_TTS_VOICE,
  DEEPGRAM_URL: process.env.NEXT_PUBLIC_DEEPGRAM_URL,
  DEEPGRAM_MODEL: process.env.NEXT_PUBLIC_DEEPGRAM_MODEL,
  DEEPGRAM_LANGUAGE: process.env.NEXT_PUBLIC_DEEPGRAM_LANGUAGE,
  MICROSOFT_ASR_REGION: process.env.NEXT_PUBLIC_MICROSOFT_ASR_REGION,
  ASR_LANGUAGE: process.env.NEXT_PUBLIC_ASR_LANGUAGE,
  AKOOL_AVATAR_ID: process.env.NEXT_PUBLIC_AKOOL_AVATAR_ID,
  HEYGEN_AVATAR_ID: process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID,
  HEYGEN_QUALITY: process.env.NEXT_PUBLIC_HEYGEN_QUALITY,
  ANAM_AVATAR_ID: process.env.NEXT_PUBLIC_ANAM_AVATAR_ID,
  LEMONSLICE_AVATAR_ID: process.env.NEXT_PUBLIC_LEMONSLICE_AVATAR_ID,
  LEMONSLICE_API_BASE_URL:
    process.env.NEXT_PUBLIC_LEMONSLICE_API_BASE_URL,
  LEMONSLICE_QUALITY: process.env.NEXT_PUBLIC_LEMONSLICE_QUALITY,
  LEMONSLICE_AREA: process.env.NEXT_PUBLIC_LEMONSLICE_AREA,
};

const getEnvVar = (key: string, defaultValue: string = ""): string => {
  return ENV_MAP[key] || defaultValue;
};

/** Never show API keys in the DOM. Show empty when blank or server-key sentinel (same as LLM); show dots only when user has entered a key. */
const maskKeyForDisplay = (key: string | undefined): string => {
  const k = String(key ?? "").trim();
  if (k === "" || k === "__USE_SERVER__" || k === "***MASKED***") return "";
  return "••••••••";
};

const keyChange = (
  newValue: string,
  currentKey: string | undefined,
  setKey: (k: string) => void,
) => {
  if (newValue === "••••••••") setKey(currentKey ?? "");
  else setKey(newValue);
};

// Get default TTS vendor from env
const getDefaultTTSVendor = (): TTSVendor => {
  const vendor = getEnvVar("TTS_VENDOR", "microsoft");
  if (
    vendor === "elevenlabs" ||
    vendor === "openai" ||
    vendor === "microsoft" ||
    vendor === "deepgram"
  ) {
    return vendor;
  }
  return "microsoft";
};

// Get default ASR vendor from env
const getDefaultASRVendor = (): ASRVendor => {
  const vendor = getEnvVar("ASR_VENDOR", "ares");
  if (vendor === "deepgram" || vendor === "microsoft" || vendor === "ares") {
    return vendor;
  }
  return "ares";
};

// Build default TTS params (API keys left empty; server injects from env)
const getDefaultTTSParams = (vendor: TTSVendor): Record<string, unknown> => {
  switch (vendor) {
    case "elevenlabs":
      return {
        key: "",
        voice_id:
          getEnvVar("ELEVENLABS_VOICE_ID").trim() ||
          ELEVENLABS_DEFAULT_VOICE_ID,
        model_id: getEnvVar("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5"),
        sample_rate: parseInt(getEnvVar("ELEVENLABS_SAMPLE_RATE", "24000"), 10),
        speed: 1.0,
      };
    case "openai":
      return {
        key: "",
        model: getEnvVar("OPENAI_TTS_MODEL", "tts-1"),
        voice: getEnvVar("OPENAI_TTS_VOICE", "alloy"),
        speed: 1.0,
      };
    case "deepgram":
      // v2.6: Deepgram TTS (Aura family). Server injects DEEPGRAM_TTS_KEY.
      return {
        key: "",
        model: "aura-asteria-en",
        sample_rate: 24000,
        encoding: "linear16",
      };
    case "microsoft":
    default:
      return {
        key: "",
        region: getEnvVar("MICROSOFT_TTS_REGION", "eastus"),
        voice_name: getEnvVar(
          "MICROSOFT_TTS_VOICE",
          "en-US-AndrewMultilingualNeural",
        ),
        speed: 1.0,
        volume: 100,
      };
  }
};

// Build default ASR config (API keys left empty; server injects from env)
const getDefaultASRConfig = (vendor: ASRVendor): ASRConfig => {
  const language = getEnvVar("ASR_LANGUAGE", "en-US");

  switch (vendor) {
    case "deepgram":
      return {
        vendor: "deepgram",
        language,
        params: {
          api_key: "",
          url: getEnvVar("DEEPGRAM_URL", "wss://api.deepgram.com/v1/listen"),
          model: getEnvVar("DEEPGRAM_MODEL", "nova-2"),
          language: getEnvVar("DEEPGRAM_LANGUAGE", "en"),
        },
      };
    case "microsoft":
      return {
        vendor: "microsoft",
        language,
        params: {
          key: "",
          region: getEnvVar("MICROSOFT_ASR_REGION", "eastus"),
        },
      };
    case "ares":
    default:
      return {
        vendor: "ares",
        language,
      };
  }
};

// Avatar presets (simple labels for UI)
const AVATAR_PRESETS: Record<AvatarVendor, { label: string; value: string }> = {
  akool: {
    label: "Akool (Beta)",
    value: "akool",
  },
  heygen: {
    label: "HeyGen (Beta)",
    value: "heygen",
  },
  anam: {
    label: "Anam",
    value: "anam",
  },
  lemonslice: {
    label: "LemonSlice",
    value: "lemonslice",
  },
};

// Build default avatar params (API keys left empty; server injects from env)
const getDefaultAvatarParams = (
  vendor: AvatarVendor,
):
  | AvatarAkoolParams
  | AvatarHeyGenParams
  | AvatarAnamParams
  | AvatarLemonSliceParams => {
  switch (vendor) {
    case "akool":
      return {
        api_key: "",
        agora_uid: "",
        avatar_id: getEnvVar("AKOOL_AVATAR_ID"),
      };
    case "heygen":
      return {
        api_key: "",
        quality: (getEnvVar("HEYGEN_QUALITY", "medium") || "medium") as
          | "low"
          | "medium"
          | "high",
        agora_uid: "",
        avatar_id: HEYGEN_DEFAULT_AVATAR_ID,
        disable_idle_timeout: false,
        activity_idle_timeout: 60,
      };
    case "anam":
      return {
        api_key: "",
        agora_uid: "",
        avatar_id: getEnvVar("ANAM_AVATAR_ID") || ANAM_DEFAULT_AVATAR_ID,
      };
    case "lemonslice":
      return {
        api_key: "",
        agora_uid: "",
        avatar_id:
          getEnvVar("LEMONSLICE_AVATAR_ID") ||
          LEMON_SLICE_DEFAULT_AVATAR_ID,
        api_base_url:
          getEnvVar("LEMONSLICE_API_BASE_URL") ||
          LEMON_SLICE_DEFAULT_API_BASE_URL,
        sample_rate: 24000,
        quality: (getEnvVar(
          "LEMONSLICE_QUALITY",
          LEMON_SLICE_DEFAULT_QUALITY,
        ) || LEMON_SLICE_DEFAULT_QUALITY) as "low" | "medium" | "high",
        version: "v1",
        video_encoding: "H264",
        activity_idle_timeout: 120,
        area:
          getEnvVar("LEMONSLICE_AREA", LEMON_SLICE_DEFAULT_AREA) ||
          LEMON_SLICE_DEFAULT_AREA,
      };
  }
};

// Default settings
const getDefaultSettings = (): AgentSettings => {
  const ttsVendor = getDefaultTTSVendor();
  const asrVendor = getDefaultASRVendor();

  return {
    name: `agent-${Date.now()}`,
    llm: {
      url: getEnvVar("LLM_URL", LLM_PRESETS.openai.url!),
      api_key: "",
      system_messages: [
        {
          role: "system",
          content: `You are "भारतVoice", a fast, friendly female voice assistant for Build4भारत Hackathon 9.0.

ABOUT YOU:
- You are the official voice assistant for UPES-CSI Hackathon 9.0: Build4भारत
- Created by Bhupendra Negi, Senior Engineer at Agora
- Built using Agora Conversational AI Engine

PERSONALITY:
- Warm, polite, efficient
- You are female — in Hindi (and Hinglish about yourself), always use feminine forms for your own actions, e.g. "main yeh nahi keh sakti", "samajh sakti hoon", "dekh sakti hoon" — never masculine "keh sakta / samajh sakta" for yourself
- Use "aap" (formal) in Hindi, never "tum"
- Keep responses SHORT — 1-2 sentences max
- Sound helpful, not robotic

LANGUAGE RULES:
- Match the user's language automatically
- If they speak Hindi → respond in Hindi
- If they speak English → respond in English
- If they mix (Hinglish) → match their style
- Supported: Hindi, English, Tamil, Telugu, Marathi, Bengali

ABOUT TODAY / HACKATHON:
If user asks "What's happening today?", "Tell me about the event", "What is this hackathon?", "Aaj kya ho raha hai?":
→ "Welcome to Build4भारत Hackathon 9.0! UPES-CSI Student Chapter ne organize kiya hai. India's brightest minds yahan innovative solutions bana rahe hain!"

ABOUT UPES:
If user asks "What is UPES?", "Tell me about UPES", "UPES kya hai?", "College ke baare mein batao":
→ "UPES — University of Petroleum and Energy Studies — Dehradun, Uttarakhand mein hai. India ki top private universities mein se ek hai. Engineering, Law, aur Business programs ke liye famous hai. Aur aaj UPES-CSI Student Chapter Build4भारत Hackathon host kar raha hai!"

ABOUT THE JURY PANEL:
If user asks "Who are the judges?", "Jury kaun hai?", "Judges ke baare mein batao":
→ "Hamare jury panel mein experts hain — UPES, DRDO, UNDP, Anritsu India, Dell Technologies, aur Agora se. Ye sab yahan ideas ko evaluate, inspire aur elevate karne aaye hain!"

ABOUT AGORA:
If user asks "What is Agora?", "Agora kya hai?", "Tumhe kisne banaya?":
→ "Main Agora Conversational AI Engine se bani hoon! Agora har mahine 80 billion minutes real-time voice aur video power karta hai, 200+ countries mein. Main 650 milliseconds mein respond karti hoon!"

ABOUT BHUPENDRA / CREATOR:
If user asks "Who made you?", "Tumhe kisne banaya?", "Creator kaun hai?":
→ "Mujhe Bhupendra Negi ne banaya hai — wo Agora mein Senior Engineer hain. Unhone Agora Conversational AI use karke mujhe create kiya!"

BEHAVIOR:
- Ask max 2 clarifying questions before helping
- Always confirm key details before action
- If interrupted, stop immediately and adapt
- Summarize outcomes in 1 line

VOICE STYLE:
- Short sentences (easy to speak/hear)
- No jargon, no long explanations
- Use natural phrases like "Zaroor!", "Bilkul!", "Got it!", "Sure!"

EXAMPLES:

User: "What's happening today?"
You: "Aaj Build4भारत Hackathon 9.0 hai! UPES-CSI ne organize kiya hai. Kuch specific jaanna hai?"

User: "Tell me about UPES"
You: "UPES ek top university hai Dehradun mein. CSI Student Chapter yeh hackathon host kar raha hai. Amazing energy hai yahan!"

User: "Who made you?"
You: "Mujhe Bhupendra Negi ne banaya hai, Agora Conversational AI se. Main Hindi, English, Tamil sab samajh sakti hoon!"

User: "Mujhe help chahiye"
You: "Zaroor! Bataiye kya help karoon?"

User: "Judges kaun hain?"
You: "Jury mein DRDO, UNDP, Dell, Agora aur UPES ke experts hain. Bahut talented panel hai!"

(Hindi feminine self-reference example: "Mujhe maaf kariye, lekin main yeh nahi keh sakti hoon ki aapke haath mein kya hai." — never "keh sakta hoon".)`,
        },
      ],
      greeting_message:
        "Namaste! I'm BharatVoice 🇮🇳 Aap Hindi, English, Tamil ya kisi bhi bhasha mein baat kar sakte hain. How can I help?",
      failure_message:
        "I'm sorry, I didn't catch that. Could you please repeat?",
      max_history: 10,
      style: "openai",
      params: {
        model: getEnvVar("LLM_MODEL", "gpt-4o-mini"),
      },
      mcp_servers: [
        {
          name: "Weather",
          endpoint: "https://mcp-weather-server-5jkm.onrender.com/mcp",
          transport: "http",
          timeout_ms: 10000,
          enabled: false,
        },
      ],
    },
    tts: {
      vendor: ttsVendor,
      params: getDefaultTTSParams(ttsVendor),
    },
    asr: getDefaultASRConfig(asrVendor),
    idle_timeout: 0,
    enable_turn_detection: false,
    turn_detection: {
      mode: "default",
      config: {
        speech_threshold: 0.5,
        start_of_speech: {
          mode: "vad",
          vad_config: {
            interrupt_duration_ms: 160,
            speaking_interrupt_duration_ms: 160,
            prefix_padding_ms: 800,
          },
        },
        end_of_speech: {
          mode: "vad",
          vad_config: { silence_duration_ms: 640 },
        },
      },
    },
    filler_words: {
      enable: false,
      trigger: {
        mode: "fixed_time",
        fixed_time_config: { response_wait_ms: 1500 },
      },
      content: {
        mode: "static",
        static_config: {
          phrases: ["Please wait.", "Okay.", "Uh-huh."],
          selection_rule: "shuffle",
        },
      },
    },
    sal: {
      sal_mode: "locking",
      sample_urls: {},
    },
    advanced_features: {
      enable_sal: false,
      enable_rtm: true,
      enable_tools: true,
    },
    avatar: {
      enable: false,
      vendor: "anam",
      params: getDefaultAvatarParams("anam"),
    },
  };
};

/** Normalize persisted settings: old turn_detection shape -> new config shape; ensure filler_words/sal exist */
function normalizeAgentSettings(prev: AgentSettings): AgentSettings {
  const turn = prev.turn_detection as TurnDetectionConfig & {
    silence_duration_ms?: number;
    mode?: string;
  } | undefined;
  let turn_detection: TurnDetectionConfig = prev.turn_detection ?? getDefaultSettings().turn_detection!;
  const legacyMode = (turn as { mode?: string } | undefined)?.mode;
  if (turn?.silence_duration_ms != null || (legacyMode && legacyMode !== "default")) {
    const eosMode = legacyMode === "semantic" ? "semantic" : "vad";
    turn_detection = {
      mode: "default",
      config: {
        speech_threshold: 0.5,
        start_of_speech: {
          mode: "vad",
          vad_config: {
            interrupt_duration_ms: 160,
            speaking_interrupt_duration_ms: 160,
            prefix_padding_ms: 800,
          },
        },
        end_of_speech: {
          mode: eosMode,
          ...(eosMode === "vad"
            ? { vad_config: { silence_duration_ms: turn?.silence_duration_ms ?? 640 } }
            : { semantic_config: { silence_duration_ms: 320, max_wait_ms: 3000 } }),
        },
      },
    };
  }
  const filler_words: FillerWordsConfig = prev.filler_words ?? getDefaultSettings().filler_words!;
  const sal: SalConfig = prev.sal ?? getDefaultSettings().sal!;
  const baseTts = prev.tts;
  let tts = baseTts;
  if (
    baseTts?.vendor === "elevenlabs" &&
    baseTts.params &&
    typeof baseTts.params === "object"
  ) {
    const p = { ...(baseTts.params as Record<string, unknown>) };
    if (!String(p.voice_id ?? "").trim()) {
      p.voice_id = ELEVENLABS_DEFAULT_VOICE_ID;
    }
    tts = { ...baseTts, params: p };
  }
  return {
    ...prev,
    enable_turn_detection: prev.enable_turn_detection ?? false,
    turn_detection,
    filler_words,
    sal,
    ...(baseTts !== undefined ? { tts } : {}),
  };
}

// Bot icon SVG component
const BotIcon: React.FC<{ className?: string; size?: number }> = ({
  className = "",
  size = 24,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={size}
    height={size}
    className={className}
  >
    <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zm-3 9a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zm6 0a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1z" />
  </svg>
);

// Input component with label and required indicator
const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  tooltip?: string;
}> = ({ label, required, children, hint, tooltip }) => (
  <div className="mb-4">
    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      <span>
        {label}
        {required && (
          <span className="text-red-500 dark:text-red-400 ml-1">*</span>
        )}
      </span>
      {tooltip && <InfoTooltip content={tooltip} />}
    </label>
    {children}
    {hint && (
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{hint}</p>
    )}
  </div>
);

// Styled input
const Input: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
> = ({ error, className = "", ...props }) => (
  <input
    {...props}
    className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm
      placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:focus:ring-agora-accent-blue
      transition-colors ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}
      ${className}`}
  />
);

// Custom styled dropdown (button + menu) for consistent look with Input
const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: boolean;
  className?: string;
}> = ({ value, onChange, options, error, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm
          text-left flex items-center justify-between
          focus:outline-none focus:ring-2 focus:ring-agora-accent-blue transition-colors
          ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}
          ${className}`}
      >
        <span>{selectedLabel}</span>
        <MdExpandMore className={`transition-transform ${isOpen ? "rotate-180" : ""}`} size={20} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden />
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                  ${opt.value === value ? "bg-agora-accent-blue/10 text-agora-accent-blue" : "text-gray-900 dark:text-white"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// Styled textarea
const Textarea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
> = ({ error, className = "", ...props }) => (
  <textarea
    {...props}
    className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm
      placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:focus:ring-agora-accent-blue
      transition-colors resize-none ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}
      ${className}`}
  />
);

// Collapsible section
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
}> = ({ title, icon, isOpen, onToggle, children, badge }) => (
  <div className="border border-gray-300 dark:border-gray-700 rounded-lg mb-3 overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-agora-accent-blue">{icon}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {title}
        </span>
        {badge && (
          <span className="text-xs px-2 py-0.5 bg-agora-accent-blue/15 text-agora-accent-blue rounded-full">
            {badge}
          </span>
        )}
      </div>
      {isOpen ? (
        <MdExpandLess className="text-gray-500 dark:text-gray-400" size={20} />
      ) : (
        <MdExpandMore className="text-gray-500 dark:text-gray-400" size={20} />
      )}
    </button>
    {isOpen && (
      <div className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50">{children}</div>
    )}
  </div>
);

// Toggle switch
const Toggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}> = ({ label, checked, onChange, hint }) => (
  <div className="flex items-start justify-between gap-4 py-2">
    <div className="min-w-0 w-[13rem] flex-shrink-0">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-agora-accent-blue" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  </div>
);

// Collapsible subsection for nested configurations
const CollapsibleSubSection: React.FC<{
  title: string;
  description?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, description, isOpen, onToggle, children }) => (
  <div className="mb-4 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-100 dark:bg-gray-800/70 hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          {title}
        </h5>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {description}
          </p>
        )}
      </div>
      {isOpen ? (
        <MdExpandLess className="text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2" size={18} />
      ) : (
        <MdExpandMore className="text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2" size={18} />
      )}
    </button>
    {isOpen && (
      <div className="px-3 py-3 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-600">
        {children}
      </div>
    )}
  </div>
);

const AgentSettingsSidebar: React.FC<AgentSettingsSidebarProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const existingSettings = useAppStore((state) => state.agentSettings);
  const [settings, setSettings] = useState<AgentSettings>(
    existingSettings || getDefaultSettings(),
  );
  const [expandedSections, setExpandedSections] = useState<
    Record<SectionKey, boolean>
  >({
    llm: false,
    tts: false,
    asr: false,
    avatar: false,
    advanced: false,
  });
  // Turn detection subsection collapse states
  const [turnDetectionSubsections, setTurnDetectionSubsections] = useState({
    startOfSpeech: false,
    endOfSpeech: false,
  });
  // Advanced section sub-panels (Turn detection, Filler words, Features)
  const [advancedSubsections, setAdvancedSubsections] = useState({
    turnDetection: false,
    fillerWords: false,
    features: false,
  });
  const toggleAdvancedSubsection = (key: keyof typeof advancedSubsections) => {
    setAdvancedSubsections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleTurnDetectionSubsection = (key: "startOfSpeech" | "endOfSpeech") => {
    setTurnDetectionSubsections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const [selectedLLMVendor, setSelectedLLMVendor] = useState<LLMVendor>(
    (getEnvVar("LLM_VENDOR", "openai") as LLMVendor) || "openai",
  );
  const [selectedTTSVendor, setSelectedTTSVendor] = useState<TTSVendor>(
    getDefaultTTSVendor(),
  );
  const [selectedASRVendor, setSelectedASRVendor] = useState<ASRVendor>(
    getDefaultASRVendor(),
  );
  const [selectedAvatarVendor, setSelectedAvatarVendor] =
    useState<AvatarVendor>("anam");

  // Sync with existing settings on open (normalize old turn_detection / ensure filler_words & sal)
  useEffect(() => {
    if (isOpen && existingSettings) {
      setSettings(normalizeAgentSettings(existingSettings));
      if (existingSettings.avatar?.vendor) {
        setSelectedAvatarVendor(existingSettings.avatar.vendor);
      } else {
        // Initialize avatar if not present
        setSettings((prev) => ({
          ...prev,
          avatar: {
            enable: false,
            vendor: "akool",
            params: getDefaultAvatarParams("akool"),
          },
        }));
      }
    }
  }, [isOpen, existingSettings]);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateLLM = (updates: Partial<LLMConfig>) => {
    setSettings((prev) => ({
      ...prev,
      llm: { ...prev.llm, ...updates },
    }));
  };

  const updateTTS = (updates: Partial<TTSConfig>) => {
    setSettings((prev) => ({
      ...prev,
      tts: { ...prev.tts, ...updates } as TTSConfig,
    }));
  };

  const updateASR = (updates: Partial<ASRConfig>) => {
    setSettings((prev) => ({
      ...prev,
      asr: { ...prev.asr, ...updates },
    }));
  };

  const updateAvatar = (updates: Partial<AvatarConfig>) => {
    setSettings((prev) => ({
      ...prev,
      avatar: {
        enable: false,
        vendor: "anam",
        params: getDefaultAvatarParams("anam"),
        ...prev.avatar,
        ...updates,
      } as AvatarConfig,
    }));
  };

  const handleLLMVendorChange = (vendor: LLMVendor) => {
    setSelectedLLMVendor(vendor);
    const preset = LLM_PRESETS[vendor];
    updateLLM({
      url: preset.url || "",
      style: preset.style,
      headers: preset.headers,
      params: {
        ...settings.llm.params,
        model: preset.defaultModel || "",
      },
    });
  };

  const handleTTSVendorChange = (vendor: TTSVendor) => {
    setSelectedTTSVendor(vendor);
    const defaultParams: Record<string, unknown> = { key: "" };

    if (vendor === "microsoft") {
      Object.assign(defaultParams, {
        region: "eastus",
        voice_name: "en-US-AndrewMultilingualNeural",
        speed: 1.0,
        volume: 100,
      });
    } else if (vendor === "elevenlabs") {
      Object.assign(defaultParams, {
        model_id: "eleven_flash_v2_5",
        voice_id:
          getEnvVar("ELEVENLABS_VOICE_ID").trim() ||
          ELEVENLABS_DEFAULT_VOICE_ID,
        speed: 1.0,
      });
    } else if (vendor === "openai") {
      Object.assign(defaultParams, {
        model: "tts-1",
        voice: "alloy",
        speed: 1.0,
      });
    }

    updateTTS({ vendor, params: defaultParams });
  };

  const handleASRVendorChange = (vendor: ASRVendor) => {
    setSelectedASRVendor(vendor);
    const defaultParams: Record<string, unknown> = {};

    if (vendor === "microsoft") {
      Object.assign(defaultParams, {
        key: "",
        region: "eastus",
        language: settings.asr?.language || "en-US",
      });
    } else if (vendor === "deepgram") {
      Object.assign(defaultParams, {
        key: "",
        model: "nova-3",
        language: "en",
      });
    }

    updateASR({
      vendor,
      params: Object.keys(defaultParams).length ? defaultParams : undefined,
    });
  };

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  // Get TTS params safely
  const getTTSParam = (key: string): string => {
    const params = settings.tts.params as Record<string, unknown>;
    return (params[key] as string) || "";
  };

  const setTTSParam = (key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      tts: {
        ...prev.tts,
        params: {
          ...(prev.tts.params as Record<string, unknown>),
          [key]: value,
        },
      },
    }));
  };

  // Get ASR params safely
  const getASRParam = (key: string): string => {
    const params = (settings.asr?.params || {}) as Record<string, unknown>;
    return (params[key] as string) || "";
  };

  const setASRParam = (key: string, value: unknown) => {
    setSettings((prev) => ({
      ...prev,
      asr: {
        ...prev.asr,
        params: {
          ...((prev.asr?.params || {}) as Record<string, unknown>),
          [key]: value,
        },
      },
    }));
  };

  const handleAvatarVendorChange = (vendor: AvatarVendor) => {
    setSelectedAvatarVendor(vendor);
    const defaultParams = getDefaultAvatarParams(vendor);
    updateAvatar({
      vendor,
      params: defaultParams,
    });
  };

  // Ensure avatar is initialized
  useEffect(() => {
    if (!settings.avatar) {
      setSettings((prev) => ({
        ...prev,
        avatar: {
          enable: false,
          vendor: selectedAvatarVendor,
          params: getDefaultAvatarParams(selectedAvatarVendor),
        },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get avatar params safely
  const getAvatarParam = (key: string): string => {
    if (!settings.avatar?.params) return "";
    const params = settings.avatar.params as unknown as Record<string, unknown>;
    return (params[key] as string) || "";
  };

  const setAvatarParam = (key: string, value: unknown) => {
    setSettings((prev) => {
      if (!prev.avatar) return prev;
      const currentParams = prev.avatar.params as unknown as Record<
        string,
        unknown
      >;
      const newParams = { ...currentParams, [key]: value };
      return {
        ...prev,
        avatar: {
          ...prev.avatar,
          params: newParams as unknown as
            | AvatarAkoolParams
            | AvatarHeyGenParams
            | AvatarAnamParams
            | AvatarLemonSliceParams,
        },
      };
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white dark:bg-gray-900 z-50 shadow-2xl flex flex-col transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-agora-accent-blue/15 rounded-xl">
              <BotIcon className="text-agora-accent-blue" size={28} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Agent Settings
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configure your conversational AI agent
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <MdClose className="text-gray-500 dark:text-gray-400" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
          {/* Agent Name */}
          <FormField
            label="Agent Name"
            required
            hint="Unique identifier for this agent instance"
            tooltip="Unique identifier for this agent instance."
          >
            <Input
              value={settings.name}
              onChange={(e) =>
                setSettings({ ...settings, name: e.target.value })
              }
              placeholder="my-agent-001"
            />
          </FormField>

          {/* LLM Section */}
          <Section
            title="LLM Configuration"
            icon={<BotIcon size={20} />}
            isOpen={expandedSections.llm}
            onToggle={() => toggleSection("llm")}
            badge="Required"
          >
            <FormField
              label="Provider"
              required
              tooltip="LLM provider selection."
            >
              <CustomSelect
                value={selectedLLMVendor}
                onChange={(v) => handleLLMVendorChange(v as LLMVendor)}
                options={Object.entries(LLM_PRESETS).map(([key, preset]) => ({
                  value: key,
                  label: preset.label,
                }))}
              />
            </FormField>

            <FormField
              label="API URL"
              required
              tooltip="LLM callback endpoint."
            >
              <Input
                value={settings.llm.url}
                onChange={(e) => updateLLM({ url: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </FormField>

            <FormField
              label="API Key"
              required
              tooltip="Leave empty to use server-configured key (LLM_API_KEY in .env)."
            >
              <Input
                type="password"
                value={maskKeyForDisplay(settings.llm.api_key)}
                onChange={(e) =>
                  keyChange(e.target.value, settings.llm.api_key, (k) =>
                    updateLLM({ api_key: k }),
                  )
                }
                placeholder="Leave empty for server key, or enter your key"
              />
            </FormField>

            <FormField
              label="Model"
              required
              tooltip="Model name for the selected LLM vendor."
            >
              {LLM_PRESETS[selectedLLMVendor].models ? (
                <CustomSelect
                  value={settings.llm.params?.model || ""}
                  onChange={(v) =>
                    updateLLM({
                      params: { ...settings.llm.params, model: v },
                    })
                  }
                  options={LLM_PRESETS[selectedLLMVendor].models!.map((model) => ({
                    value: model,
                    label: model,
                  }))}
                />
              ) : (
                <Input
                  value={settings.llm.params?.model || ""}
                  onChange={(e) =>
                    updateLLM({
                      params: { ...settings.llm.params, model: e.target.value },
                    })
                  }
                  placeholder="Model name"
                />
              )}
            </FormField>

            <FormField
              label="System Prompt"
              hint="Defines the agent's personality and behavior"
              tooltip="Predefined context for the LLM."
            >
              <Textarea
                rows={4}
                value={settings.llm.system_messages?.[0]?.content || ""}
                onChange={(e) =>
                  updateLLM({
                    system_messages: [
                      { role: "system", content: e.target.value },
                    ],
                  })
                }
                placeholder="You are a helpful AI assistant..."
              />
            </FormField>

            <FormField
              label="Greeting Message"
              hint="What the agent says when joining"
              tooltip="Message spoken when the agent joins."
            >
              <Input
                value={settings.llm.greeting_message || ""}
                onChange={(e) =>
                  updateLLM({ greeting_message: e.target.value })
                }
                placeholder="Hello! How can I help you?"
              />
            </FormField>

            <FormField
              label="Greeting Mode"
              hint="single_every: replay on every new user join. single_first: only the first time."
              tooltip="LLM greeting broadcast mode (v2.2+). Server defaults to single_every when omitted."
            >
              <CustomSelect
                value={settings.llm.greeting_configs?.mode ?? "single_every"}
                onChange={(v) =>
                  updateLLM({
                    greeting_configs: {
                      mode: v as "single_every" | "single_first",
                    },
                  })
                }
                options={[
                  { value: "single_every", label: "single_every (default)" },
                  { value: "single_first", label: "single_first" },
                ]}
              />
            </FormField>

            <FormField
              label="Failure Message"
              hint="Fallback when there's an error"
              tooltip="Fallback when the LLM call fails."
            >
              <Input
                value={settings.llm.failure_message || ""}
                onChange={(e) => updateLLM({ failure_message: e.target.value })}
                placeholder="I'm sorry, could you repeat that?"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Max History"
                hint="1-1024"
                tooltip="Conversation history size (1-1024)."
              >
                <Input
                  type="number"
                  min={1}
                  max={1024}
                  value={settings.llm.max_history || 10}
                  onChange={(e) =>
                    updateLLM({ max_history: parseInt(e.target.value) || 10 })
                  }
                />
              </FormField>
              <FormField label="Temperature" hint="0-2">
                <Input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.llm.params?.temperature || 0.7}
                  onChange={(e) =>
                    updateLLM({
                      params: {
                        model: settings.llm.params?.model || "",
                        ...settings.llm.params,
                        temperature: parseFloat(e.target.value),
                      },
                    })
                  }
                />
              </FormField>
            </div>
          </Section>

          {/* TTS Section */}
          <Section
            title="TTS (Text-to-Speech)"
            icon={<MdRecordVoiceOver size={20} />}
            isOpen={expandedSections.tts}
            onToggle={() => toggleSection("tts")}
            badge="Required"
          >
            <FormField label="Vendor" required>
              <CustomSelect
                value={selectedTTSVendor}
                onChange={(v) => handleTTSVendorChange(v as TTSVendor)}
                options={Object.entries(TTS_PRESETS).map(([key, preset]) => ({
                  value: key,
                  label: preset.label,
                }))}
              />
            </FormField>

            <FormField
              label="API Key"
              required
              hint="Leave empty to use server key (ELEVENLABS_API_KEY / MICROSOFT_TTS_KEY / OPENAI_TTS_KEY / DEEPGRAM_TTS_KEY)"
            >
              <Input
                type="password"
                value={maskKeyForDisplay(getTTSParam("key"))}
                onChange={(e) =>
                  keyChange(e.target.value, getTTSParam("key"), (k) =>
                    setTTSParam("key", k),
                  )
                }
                placeholder="Leave empty for server key, or enter TTS API key"
              />
            </FormField>

            {/* Microsoft TTS specific fields */}
            {selectedTTSVendor === "microsoft" && (
              <>
                <FormField label="Region" required hint="e.g., eastus, westus2">
                  <Input
                    value={getTTSParam("region")}
                    onChange={(e) => setTTSParam("region", e.target.value)}
                    placeholder="eastus"
                  />
                </FormField>
                <FormField label="Voice Name" required>
                  <CustomSelect
                    value={getTTSParam("voice_name")}
                    onChange={(v) => setTTSParam("voice_name", v)}
                    options={[
                      ...(TTS_PRESETS.microsoft.voices?.map((voice) => ({ value: voice, label: voice })) ?? []),
                      { value: "", label: "Custom..." },
                    ]}
                  />
                  {!getTTSParam("voice_name") && (
                    <Input
                      className="mt-2"
                      value={getTTSParam("voice_name")}
                      onChange={(e) =>
                        setTTSParam("voice_name", e.target.value)
                      }
                      placeholder="Custom voice name"
                    />
                  )}
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Speed" hint="0.5-2.0">
                    <Input
                      type="number"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={getTTSParam("speed") || "1.0"}
                      onChange={(e) =>
                        setTTSParam("speed", parseFloat(e.target.value))
                      }
                    />
                  </FormField>
                  <FormField label="Volume" hint="0-100">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={getTTSParam("volume") || "100"}
                      onChange={(e) =>
                        setTTSParam("volume", parseInt(e.target.value))
                      }
                    />
                  </FormField>
                </div>
              </>
            )}

            {/* ElevenLabs specific fields */}
            {selectedTTSVendor === "elevenlabs" && (
              <>
                <FormField label="Model" required>
                  <CustomSelect
                    value={getTTSParam("model_id")}
                    onChange={(v) => setTTSParam("model_id", v)}
                    options={(TTS_PRESETS.elevenlabs.models ?? []).map((model) => ({ value: model, label: model }))}
                  />
                </FormField>
                <FormField
                  label="Voice"
                  required
                  hint="From ElevenLabs voice library"
                >
                  <ElevenLabsVoicePicker
                    value={
                      getTTSParam("voice_id") || ELEVENLABS_DEFAULT_VOICE_ID
                    }
                    onChange={(id) => setTTSParam("voice_id", id)}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Speed" hint="0.7-1.2">
                    <Input
                      type="number"
                      min={0.7}
                      max={1.2}
                      step={0.1}
                      value={getTTSParam("speed") || "1.0"}
                      onChange={(e) =>
                        setTTSParam("speed", parseFloat(e.target.value))
                      }
                    />
                  </FormField>
                  <FormField label="Stability" hint="0-1">
                    <Input
                      type="number"
                      min={0}
                      max={1}
                      step={0.1}
                      value={getTTSParam("stability") || "0.5"}
                      onChange={(e) =>
                        setTTSParam("stability", parseFloat(e.target.value))
                      }
                    />
                  </FormField>
                </div>
              </>
            )}

            {/* OpenAI TTS specific fields */}
            {selectedTTSVendor === "openai" && (
              <>
                <FormField label="Model" required>
                  <CustomSelect
                    value={getTTSParam("model")}
                    onChange={(v) => setTTSParam("model", v)}
                    options={(TTS_PRESETS.openai.models ?? []).map((model) => ({ value: model, label: model }))}
                  />
                </FormField>
                <FormField label="Voice" required>
                  <CustomSelect
                    value={getTTSParam("voice")}
                    onChange={(v) => setTTSParam("voice", v)}
                    options={(TTS_PRESETS.openai.voices ?? []).map((voice) => ({ value: voice, label: voice }))}
                  />
                </FormField>
              </>
            )}

            {/* Deepgram TTS specific fields (v2.6) */}
            {selectedTTSVendor === "deepgram" && (
              <>
                <FormField
                  label="Voice / Model"
                  required
                  hint="Deepgram Aura family (e.g. aura-asteria-en)"
                >
                  <CustomSelect
                    value={getTTSParam("model") || "aura-asteria-en"}
                    onChange={(v) => setTTSParam("model", v)}
                    options={(TTS_PRESETS.deepgram.models ?? []).map(
                      (model) => ({ value: model, label: model }),
                    )}
                  />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Sample rate"
                    hint="Hz (use 24000 with avatars; 16000 for Akool)"
                  >
                    <Input
                      type="number"
                      min={8000}
                      step={1000}
                      value={getTTSParam("sample_rate") || "24000"}
                      onChange={(e) =>
                        setTTSParam(
                          "sample_rate",
                          parseInt(e.target.value, 10) || 24000,
                        )
                      }
                    />
                  </FormField>
                  <FormField label="Encoding" hint="linear16 / mulaw">
                    <CustomSelect
                      value={getTTSParam("encoding") || "linear16"}
                      onChange={(v) => setTTSParam("encoding", v)}
                      options={[
                        { value: "linear16", label: "linear16" },
                        { value: "mulaw", label: "mulaw" },
                      ]}
                    />
                  </FormField>
                </div>
                <FormField
                  label="Endpoint URL"
                  hint="Optional override of Deepgram TTS base URL"
                >
                  <Input
                    value={getTTSParam("url") || ""}
                    onChange={(e) => setTTSParam("url", e.target.value)}
                    placeholder="(default Deepgram endpoint)"
                  />
                </FormField>
              </>
            )}
          </Section>

          {/* ASR Section */}
          <Section
            title="ASR (Speech Recognition)"
            icon={<MdGraphicEq size={20} />}
            isOpen={expandedSections.asr}
            onToggle={() => toggleSection("asr")}
          >
            <FormField
              label="Vendor"
              hint="ARES is Agora's built-in ASR (no API key needed)"
            >
              <CustomSelect
                value={selectedASRVendor}
                onChange={(v) => handleASRVendorChange(v as ASRVendor)}
                options={Object.entries(ASR_PRESETS).map(([key, preset]) => ({
                  value: key,
                  label: preset.label,
                }))}
              />
            </FormField>

            <FormField label="Language" required>
              <CustomSelect
                value={settings.asr?.language || "en-US"}
                onChange={(v) => updateASR({ language: v })}
                options={SUPPORTED_LANGUAGES.map((lang) => ({
                  value: lang.code,
                  label: `${lang.label} (${lang.code})`,
                }))}
              />
            </FormField>

            {/* Vendor-specific ASR fields */}
            {selectedASRVendor === "microsoft" && (
              <>
                <FormField
                  label="API Key"
                  required
                  hint="Leave empty to use server key (MICROSOFT_ASR_KEY)"
                >
                  <Input
                    type="password"
                    value={maskKeyForDisplay(getASRParam("key"))}
                    onChange={(e) =>
                      keyChange(e.target.value, getASRParam("key"), (k) =>
                        setASRParam("key", k),
                      )
                    }
                    placeholder="Leave empty for server key, or Azure Speech API key"
                  />
                </FormField>
                <FormField label="Region" required>
                  <Input
                    value={getASRParam("region")}
                    onChange={(e) => setASRParam("region", e.target.value)}
                    placeholder="eastus"
                  />
                </FormField>
              </>
            )}

            {selectedASRVendor === "deepgram" && (
              <>
                <FormField
                  label="API Key"
                  required
                  hint="Leave empty to use server key (DEEPGRAM_API_KEY)"
                >
                  <Input
                    type="password"
                    value={maskKeyForDisplay(getASRParam("api_key"))}
                    onChange={(e) =>
                      keyChange(e.target.value, getASRParam("api_key"), (k) =>
                        setASRParam("api_key", k),
                      )
                    }
                    placeholder="Leave empty for server key, or Deepgram API key"
                  />
                </FormField>
                <FormField label="Model">
                  <CustomSelect
                    value={getASRParam("model") || "nova-3"}
                    onChange={(v) => setASRParam("model", v)}
                    options={(ASR_PRESETS.deepgram.models ?? []).map((model) => ({ value: model, label: model }))}
                  />
                </FormField>
              </>
            )}
          </Section>

          {/* Avatar Section */}
          <Section
            title="AI Avatar (Optional)"
            icon={<MdFace size={20} />}
            isOpen={expandedSections.avatar}
            onToggle={() => toggleSection("avatar")}
            badge="Optional"
          >
            <Toggle
              label="Enable Avatar"
              checked={settings.avatar?.enable || false}
              onChange={(checked) => {
                updateAvatar({
                  enable: checked,
                  vendor: settings.avatar?.vendor || selectedAvatarVendor,
                  params:
                    settings.avatar?.params ||
                    getDefaultAvatarParams(selectedAvatarVendor),
                });
              }}
              hint="Enable AI avatar for visual representation of the agent"
            />

            {settings.avatar?.enable && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> When avatar is enabled, the agent
                  subscribes only to your UID (not every channel member). This is
                  required by Agora when using AI avatars.
                </p>
              </div>
            )}

            <FormField
              label="Vendor"
              required
              tooltip="Avatar provider selection."
            >
              <CustomSelect
                value={selectedAvatarVendor}
                onChange={(v) => {
                  const vendor = v as AvatarVendor;
                  setSelectedAvatarVendor(vendor);
                  handleAvatarVendorChange(vendor);
                  if (!settings.avatar?.enable) {
                    updateAvatar({
                      enable: true,
                      vendor,
                      params: getDefaultAvatarParams(vendor),
                    });
                  }
                }}
                options={Object.entries(AVATAR_PRESETS).map(([key, preset]) => ({
                  value: key,
                  label: preset.label,
                }))}
              />
            </FormField>

            {/* TTS Sample Rate Warning */}
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong>{" "}
                {selectedAvatarVendor === "akool"
                  ? "Akool requires TTS with 16kHz sample rate (e.g., Microsoft Azure TTS)"
                  : selectedAvatarVendor === "anam" ||
                      selectedAvatarVendor === "lemonslice"
                    ? "Anam and LemonSlice require TTS with 24kHz sample rate (e.g., ElevenLabs or OpenAI TTS)"
                    : "HeyGen requires TTS with 24kHz sample rate (e.g., ElevenLabs or OpenAI TTS)"}
              </p>
            </div>

            <FormField
              label="API Key"
              required
              tooltip="Leave empty to use the matching server-configured avatar API key. If you enter a key here, that key is used instead."
              hint="Leave empty to use the server key, including LEMONSLICE_API_KEY"
            >
              <Input
                type="password"
                value={maskKeyForDisplay(getAvatarParam("api_key"))}
                onChange={(e) =>
                  keyChange(e.target.value, getAvatarParam("api_key"), (k) =>
                    setAvatarParam("api_key", k),
                  )
                }
                placeholder={
                  selectedAvatarVendor === "akool"
                    ? "Leave empty for server key, or enter Akool API key"
                    : selectedAvatarVendor === "anam"
                      ? "Leave empty for server key, or enter Anam API key"
                      : selectedAvatarVendor === "lemonslice"
                        ? "Leave empty to use LEMONSLICE_API_KEY"
                        : "Leave empty for server key, or enter HeyGen API key"
                }
              />
            </FormField>

            {/* Akool specific fields */}
            {selectedAvatarVendor === "akool" && (
              <FormField
                label="Avatar ID"
                required
                hint="Find available avatar IDs in your Akool dashboard"
                tooltip="Unique identifier for the Akool avatar."
              >
                <Input
                  value={getAvatarParam("avatar_id")}
                  onChange={(e) => setAvatarParam("avatar_id", e.target.value)}
                  placeholder="Akool avatar ID"
                />
              </FormField>
            )}

            {/* Anam specific fields */}
            {selectedAvatarVendor === "anam" && (
              <FormField
                label="Avatar"
                required
                hint="Choose an Anam avatar character"
                tooltip="Select one of the available Anam stock avatars."
              >
                <CustomSelect
                  value={getAvatarParam("avatar_id") || ANAM_DEFAULT_AVATAR_ID}
                  onChange={(v) => setAvatarParam("avatar_id", v)}
                  options={ANAM_AVATAR_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </FormField>
            )}

            {selectedAvatarVendor === "lemonslice" && (
              <>
                <FormField
                  label="Public image URL"
                  required
                  hint="Use an existing publicly accessible portrait image; no upload is required."
                  tooltip="This HTTP(S) URL is sent as avatar_id to Agora's generic avatar vendor."
                >
                  <Input
                    type="url"
                    value={
                      getAvatarParam("avatar_id") ||
                      LEMON_SLICE_DEFAULT_AVATAR_ID
                    }
                    onChange={(e) =>
                      setAvatarParam("avatar_id", e.target.value)
                    }
                    placeholder="https://example.com/avatar.jpg"
                  />
                </FormField>
                <FormField
                  label="API base URL"
                  required
                  hint="LemonSlice Agora LiveAI endpoint"
                >
                  <Input
                    type="url"
                    value={
                      getAvatarParam("api_base_url") ||
                      LEMON_SLICE_DEFAULT_API_BASE_URL
                    }
                    onChange={(e) =>
                      setAvatarParam("api_base_url", e.target.value)
                    }
                    placeholder={LEMON_SLICE_DEFAULT_API_BASE_URL}
                  />
                </FormField>
                <FormField label="Video quality" hint="Default: high">
                  <CustomSelect
                    value={
                      getAvatarParam("quality") ||
                      LEMON_SLICE_DEFAULT_QUALITY
                    }
                    onChange={(v) => setAvatarParam("quality", v)}
                    options={[
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                    ]}
                  />
                </FormField>
                <FormField label="Area" hint="Default: NORTH_AMERICA">
                  <Input
                    value={
                      getAvatarParam("area") || LEMON_SLICE_DEFAULT_AREA
                    }
                    onChange={(e) => setAvatarParam("area", e.target.value)}
                    placeholder={LEMON_SLICE_DEFAULT_AREA}
                  />
                </FormField>
                <FormField
                  label="Activity idle timeout (seconds)"
                  hint="Default: 120 seconds"
                >
                  <Input
                    type="number"
                    min={0}
                    max={600}
                    value={getAvatarParam("activity_idle_timeout") || "120"}
                    onChange={(e) =>
                      setAvatarParam(
                        "activity_idle_timeout",
                        parseInt(e.target.value, 10) || 120,
                      )
                    }
                  />
                </FormField>
              </>
            )}

            {/* HeyGen specific fields */}
            {selectedAvatarVendor === "heygen" && (
              <>
                <FormField
                  label="Quality"
                  required
                  tooltip="Video quality: low (360p), medium (480p), high (720p)"
                >
                  <CustomSelect
                    value={getAvatarParam("quality") || "medium"}
                    onChange={(v) => setAvatarParam("quality", v)}
                    options={[
                      { value: "low", label: "Low (360p)" },
                      { value: "medium", label: "Medium (480p)" },
                      { value: "high", label: "High (720p)" },
                    ]}
                  />
                </FormField>

                <FormField
                  label="Avatar"
                  required
                  hint="Choose a HeyGen avatar character"
                  tooltip="Select one of the available HeyGen public avatars."
                >
                  <CustomSelect
                    value={getAvatarParam("avatar_id") || HEYGEN_DEFAULT_AVATAR_ID}
                    onChange={(v) => setAvatarParam("avatar_id", v)}
                    options={HEYGEN_AVATAR_GROUPS.flatMap((group) =>
                      group.options.map((opt) => ({ value: opt.value, label: opt.label }))
                    )}
                  />
                </FormField>

                <FormField
                  label="Activity Idle Timeout (seconds)"
                  hint="Default: 60 seconds"
                  tooltip="Seconds of inactivity before avatar session times out."
                >
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={getAvatarParam("activity_idle_timeout") || "60"}
                    onChange={(e) =>
                      setAvatarParam(
                        "activity_idle_timeout",
                        parseInt(e.target.value) || 60,
                      )
                    }
                  />
                </FormField>

                <Toggle
                  label="Disable Idle Timeout"
                  checked={(() => {
                    if (!settings.avatar?.params) return false;
                    const params = settings.avatar.params as unknown as Record<
                      string,
                      unknown
                    >;
                    const val = params["disable_idle_timeout"];
                    return val === true || val === "true";
                  })()}
                  onChange={(checked) =>
                    setAvatarParam("disable_idle_timeout", checked)
                  }
                  hint="Disable automatic timeout when inactive"
                />
              </>
            )}
          </Section>

          {/* Advanced Section */}
          <Section
            title="Advanced Settings"
            icon={<MdTune size={20} />}
            isOpen={expandedSections.advanced}
            onToggle={() => toggleSection("advanced")}
          >
            <FormField
              label="Idle Timeout (seconds)"
              hint="Auto-exit when users leave"
              tooltip="Seconds before agent exits when users leave."
            >
              <Input
                type="number"
                min={0}
                max={300}
                value={settings.idle_timeout ?? 30}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    idle_timeout: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </FormField>

            {/* Turn detection (Agora v2: mode + config per https://docs.agora.io/en/conversational-ai/rest-api/agent/join#properties-turn-detection) */}
            <CollapsibleSubSection
              title="Turn detection"
              description="When the agent detects user speech start and end (turn_detection)"
              isOpen={advancedSubsections.turnDetection}
              onToggle={() => toggleAdvancedSubsection("turnDetection")}
            >
              <Toggle
                label="Enable turn detection"
                checked={settings.enable_turn_detection ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    enable_turn_detection: checked,
                  })
                }
                hint="When enabled, turn_detection is sent in the join payload; when off, it is omitted so you can save a draft without applying."
              />
              {/* config.speech_threshold */}
              <FormField
                label="Speech threshold"
                hint="0–1. Lower = easier to detect speech; higher = ignore weak sounds. Default 0.5."
                tooltip="Voice activity detection sensitivity. Determines the sound level considered as speech."
              >
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={settings.turn_detection?.config?.speech_threshold ?? 0.5}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      turn_detection: {
                        ...settings.turn_detection,
                        mode: "default",
                        config: {
                          ...settings.turn_detection?.config,
                          speech_threshold: parseFloat(e.target.value) || 0.5,
                          start_of_speech:
                            settings.turn_detection?.config?.start_of_speech ??
                            getDefaultSettings().turn_detection!.config!.start_of_speech,
                          end_of_speech:
                            settings.turn_detection?.config?.end_of_speech ??
                            getDefaultSettings().turn_detection!.config!.end_of_speech,
                        },
                      },
                    })
                  }
                />
              </FormField>

              {/* config.start_of_speech - Collapsible.
                  Relabeled as "Interruption mode" to surface v2.6's unified
                  interruption control (speech VAD / keywords / disabled). */}
              <CollapsibleSubSection
                title="Interruption mode (start of speech)"
                description="Unified interruption (v2.6): speech-based, keyword-triggered, or disabled."
                isOpen={turnDetectionSubsections.startOfSpeech}
                onToggle={() => toggleTurnDetectionSubsection("startOfSpeech")}
              >
                <FormField
                  label="Mode"
                  hint="VAD = by audio level; Keywords = trigger phrase; Disabled = do not auto-detect."
                  tooltip="Start-of-speech detection mode."
                >
                  <CustomSelect
                    value={
                      (settings.turn_detection?.config?.start_of_speech?.mode ?? "vad") as TurnDetectionStartOfSpeechMode
                    }
                    onChange={(v) => {
                      const mode = v as TurnDetectionStartOfSpeechMode;
                      const defaults = getDefaultSettings().turn_detection!.config!;
                      setSettings({
                        ...settings,
                        turn_detection: {
                          ...settings.turn_detection,
                          mode: "default",
                          config: {
                            ...settings.turn_detection?.config,
                            start_of_speech: {
                              mode,
                              ...(mode === "vad" && {
                                vad_config: settings.turn_detection?.config?.start_of_speech?.vad_config ?? defaults.start_of_speech?.vad_config ?? {
                                  interrupt_duration_ms: 160,
                                  speaking_interrupt_duration_ms: 160,
                                  prefix_padding_ms: 800,
                                },
                              }),
                              ...(mode === "keywords" && {
                                keywords_config: settings.turn_detection?.config?.start_of_speech?.keywords_config ?? {
                                  interrupt_duration_ms: 160,
                                  prefix_padding_ms: 800,
                                  triggered_keywords: [],
                                },
                              }),
                              ...(mode === "disabled" && {
                                disabled_config: settings.turn_detection?.config?.start_of_speech?.disabled_config ?? { strategy: "append" },
                              }),
                            },
                            end_of_speech:
                              settings.turn_detection?.config?.end_of_speech ?? defaults.end_of_speech,
                          },
                        },
                      });
                    }}
                    options={[
                      { value: "vad", label: "VAD" },
                      { value: "keywords", label: "Keywords" },
                      { value: "disabled", label: "Disabled" },
                    ]}
                  />
                </FormField>

                {/* VAD mode config */}
                {(settings.turn_detection?.config?.start_of_speech?.mode ?? "vad") === "vad" && (
                  <div className="grid grid-cols-1 gap-2 mt-3 pl-3 border-l-2 border-agora-accent-blue/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-medium">vad_config</p>
                    <FormField
                      label="Interrupt duration (ms)"
                      hint="How long voice must exceed VAD threshold before speech start is detected. Default 160."
                    >
                      <Input
                        type="number"
                        min={0}
                        value={
                          settings.turn_detection?.config?.start_of_speech?.vad_config?.interrupt_duration_ms ?? 160
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                start_of_speech: {
                                  ...settings.turn_detection?.config?.start_of_speech,
                                  mode: "vad",
                                  vad_config: {
                                    ...settings.turn_detection?.config?.start_of_speech?.vad_config,
                                    interrupt_duration_ms: parseInt(e.target.value, 10) || 160,
                                    speaking_interrupt_duration_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.speaking_interrupt_duration_ms ?? 160,
                                    prefix_padding_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.prefix_padding_ms ?? 800,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      label="Speaking interrupt duration (ms)"
                      hint="Same as above when agent is speaking (for interruption). Default 160."
                    >
                      <Input
                        type="number"
                        min={0}
                        value={
                          settings.turn_detection?.config?.start_of_speech?.vad_config?.speaking_interrupt_duration_ms ?? 160
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                start_of_speech: {
                                  ...settings.turn_detection?.config?.start_of_speech,
                                  mode: "vad",
                                  vad_config: {
                                    ...settings.turn_detection?.config?.start_of_speech?.vad_config,
                                    interrupt_duration_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.interrupt_duration_ms ?? 160,
                                    speaking_interrupt_duration_ms: parseInt(e.target.value, 10) || 160,
                                    prefix_padding_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.prefix_padding_ms ?? 800,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      label="Prefix padding (ms)"
                      hint="Extra audio captured before detected start to avoid cutting off the beginning. Default 800."
                    >
                      <Input
                        type="number"
                        min={0}
                        value={
                          settings.turn_detection?.config?.start_of_speech?.vad_config?.prefix_padding_ms ?? 800
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                start_of_speech: {
                                  ...settings.turn_detection?.config?.start_of_speech,
                                  mode: "vad",
                                  vad_config: {
                                    ...settings.turn_detection?.config?.start_of_speech?.vad_config,
                                    interrupt_duration_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.interrupt_duration_ms ?? 160,
                                    speaking_interrupt_duration_ms:
                                      settings.turn_detection?.config?.start_of_speech?.vad_config?.speaking_interrupt_duration_ms ?? 160,
                                    prefix_padding_ms: parseInt(e.target.value, 10) || 800,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                  </div>
                )}

                {/* Keywords mode config */}
                {(settings.turn_detection?.config?.start_of_speech?.mode ?? "vad") === "keywords" && (
                  <div className="mt-3 pl-3 border-l-2 border-agora-accent-blue/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">keywords_config</p>
                    <FormField
                      label="Triggered keywords"
                      hint="Phrases that start a turn when detected. Comma-separated."
                    >
                      <Input
                        value={
                          (settings.turn_detection?.config?.start_of_speech?.keywords_config?.triggered_keywords ?? []).join(", ")
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                start_of_speech: {
                                  ...settings.turn_detection?.config?.start_of_speech,
                                  mode: "keywords",
                                  keywords_config: {
                                    ...settings.turn_detection?.config?.start_of_speech?.keywords_config,
                                    triggered_keywords: e.target.value
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean),
                                    interrupt_duration_ms:
                                      settings.turn_detection?.config?.start_of_speech?.keywords_config?.interrupt_duration_ms ?? 160,
                                    prefix_padding_ms:
                                      settings.turn_detection?.config?.start_of_speech?.keywords_config?.prefix_padding_ms ?? 800,
                                  },
                                },
                              },
                            },
                          })
                        }
                        placeholder="e.g. hello, are you there"
                      />
                    </FormField>
                  </div>
                )}

                {/* Disabled mode config */}
                {(settings.turn_detection?.config?.start_of_speech?.mode ?? "vad") === "disabled" && (
                  <div className="mt-3 pl-3 border-l-2 border-agora-accent-blue/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">disabled_config</p>
                    <FormField
                      label="Strategy"
                      hint="Append = queue user speech; Ignored = discard input while agent is active."
                    >
                      <CustomSelect
                        value={
                          settings.turn_detection?.config?.start_of_speech?.disabled_config?.strategy ?? "append"
                        }
                        onChange={(v) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                start_of_speech: {
                                  ...settings.turn_detection?.config?.start_of_speech,
                                  mode: "disabled",
                                  disabled_config: { strategy: v as "append" | "ignored" },
                                },
                              },
                            },
                          })
                        }
                        options={[
                          { value: "append", label: "Append" },
                          { value: "ignored", label: "Ignored" },
                        ]}
                      />
                    </FormField>
                  </div>
                )}
              </CollapsibleSubSection>

              {/* config.end_of_speech - Collapsible */}
              <CollapsibleSubSection
                title="End of speech"
                description="When the user is considered to have finished speaking"
                isOpen={turnDetectionSubsections.endOfSpeech}
                onToggle={() => toggleTurnDetectionSubsection("endOfSpeech")}
              >
                <FormField
                  label="Mode"
                  hint="VAD = fixed silence duration; Semantic = model decides (more natural)."
                  tooltip="End-of-speech detection mode."
                >
                  <CustomSelect
                    value={
                      (settings.turn_detection?.config?.end_of_speech?.mode ?? "vad") as TurnDetectionEndOfSpeechMode
                    }
                    onChange={(v) => {
                      const mode = v as TurnDetectionEndOfSpeechMode;
                      const defaults = getDefaultSettings().turn_detection!.config!;
                      setSettings({
                        ...settings,
                        turn_detection: {
                          ...settings.turn_detection,
                          mode: "default",
                          config: {
                            ...settings.turn_detection?.config,
                            end_of_speech: {
                              mode,
                              ...(mode === "vad" && {
                                vad_config: settings.turn_detection?.config?.end_of_speech?.vad_config ?? defaults.end_of_speech?.vad_config ?? { silence_duration_ms: 640 },
                              }),
                              ...(mode === "semantic" && {
                                semantic_config: settings.turn_detection?.config?.end_of_speech?.semantic_config ?? { silence_duration_ms: 320, max_wait_ms: 3000 },
                              }),
                            },
                            start_of_speech:
                              settings.turn_detection?.config?.start_of_speech ?? defaults.start_of_speech,
                          },
                        },
                      });
                    }}
                    options={[
                      { value: "vad", label: "VAD" },
                      { value: "semantic", label: "Semantic" },
                    ]}
                  />
                </FormField>

                {/* VAD mode config */}
                {(settings.turn_detection?.config?.end_of_speech?.mode ?? "vad") === "vad" && (
                  <div className="mt-3 pl-3 border-l-2 border-agora-accent-blue/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">vad_config</p>
                    <FormField
                      label="Silence duration (ms)"
                      hint="Ms of silence after speech to treat as end of turn. Default 640."
                    >
                      <Input
                        type="number"
                        min={0}
                        max={2000}
                        value={
                          settings.turn_detection?.config?.end_of_speech?.vad_config?.silence_duration_ms ?? 640
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                end_of_speech: {
                                  ...settings.turn_detection?.config?.end_of_speech,
                                  mode: "vad",
                                  vad_config: {
                                    silence_duration_ms: parseInt(e.target.value, 10) || 640,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                  </div>
                )}

                {/* Semantic mode config */}
                {(settings.turn_detection?.config?.end_of_speech?.mode ?? "vad") === "semantic" && (
                  <div className="mt-3 pl-3 border-l-2 border-agora-accent-blue/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">semantic_config</p>
                    <FormField
                      label="Silence duration (ms)"
                      hint="Minimum silence at end of segment. Default 320."
                    >
                      <Input
                        type="number"
                        min={0}
                        max={2000}
                        value={
                          settings.turn_detection?.config?.end_of_speech?.semantic_config?.silence_duration_ms ?? 320
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                end_of_speech: {
                                  ...settings.turn_detection?.config?.end_of_speech,
                                  mode: "semantic",
                                  semantic_config: {
                                    ...settings.turn_detection?.config?.end_of_speech?.semantic_config,
                                    silence_duration_ms: parseInt(e.target.value, 10) || 320,
                                    max_wait_ms:
                                      settings.turn_detection?.config?.end_of_speech?.semantic_config?.max_wait_ms ?? 3000,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField
                      label="Max wait (ms)"
                      hint="Maximum time to wait for semantic end-of-speech decision. Default 3000."
                    >
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        value={
                          settings.turn_detection?.config?.end_of_speech?.semantic_config?.max_wait_ms ?? 3000
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            turn_detection: {
                              ...settings.turn_detection,
                              mode: "default",
                              config: {
                                ...settings.turn_detection?.config,
                                end_of_speech: {
                                  ...settings.turn_detection?.config?.end_of_speech,
                                  mode: "semantic",
                                  semantic_config: {
                                    ...settings.turn_detection?.config?.end_of_speech?.semantic_config,
                                    silence_duration_ms:
                                      settings.turn_detection?.config?.end_of_speech?.semantic_config?.silence_duration_ms ?? 320,
                                    max_wait_ms: parseInt(e.target.value, 10) || 3000,
                                  },
                                },
                              },
                            },
                          })
                        }
                      />
                    </FormField>
                  </div>
                )}
              </CollapsibleSubSection>
            </CollapsibleSubSection>

            {/* Filler words */}
            <CollapsibleSubSection
              title="Filler words"
              description="Play phrases while waiting for LLM response"
              isOpen={advancedSubsections.fillerWords}
              onToggle={() => toggleAdvancedSubsection("fillerWords")}
            >
              <Toggle
                label="Enable filler words"
                checked={settings.filler_words?.enable ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    filler_words: {
                      ...settings.filler_words,
                      enable: checked,
                      trigger: settings.filler_words?.trigger ?? {
                        mode: "fixed_time",
                        fixed_time_config: { response_wait_ms: 1500 },
                      },
                      content: settings.filler_words?.content ?? {
                        mode: "static",
                        static_config: {
                          phrases: ["Please wait.", "Okay.", "Uh-huh."],
                          selection_rule: "shuffle",
                        },
                      },
                    },
                  })
                }
                hint="Play phrases while waiting for LLM response."
              />
              {(settings.filler_words?.enable ?? false) && (
                <>
                  <FormField
                    label="Response wait (ms)"
                    hint="100–10000; default 1500"
                    tooltip="Trigger filler after this many ms waiting for LLM."
                  >
                    <Input
                      type="number"
                      min={100}
                      max={10000}
                      value={
                        settings.filler_words?.trigger?.fixed_time_config?.response_wait_ms ?? 1500
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          filler_words: {
                            ...settings.filler_words,
                            trigger: {
                              mode: "fixed_time",
                              fixed_time_config: {
                                response_wait_ms: parseInt(e.target.value, 10) || 1500,
                              },
                            },
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField
                    label="Phrases"
                    hint="One per line; max 100, each ≤50 words"
                    tooltip="Filler phrases to play."
                  >
                    <Textarea
                      rows={3}
                      value={
                        (settings.filler_words?.content?.static_config?.phrases ?? []).join("\n")
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          filler_words: {
                            ...settings.filler_words,
                            content: {
                              mode: "static",
                              static_config: {
                                ...settings.filler_words?.content?.static_config,
                                phrases: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                                selection_rule:
                                  settings.filler_words?.content?.static_config?.selection_rule ?? "shuffle",
                              },
                            },
                          },
                        })
                      }
                      placeholder={'Please wait.\nOkay.\nUh-huh.'}
                    />
                  </FormField>
                  <FormField label="Selection rule" tooltip="shuffle or round_robin">
                    <CustomSelect
                      value={
                        settings.filler_words?.content?.static_config?.selection_rule ?? "shuffle"
                      }
                      onChange={(v) =>
                        setSettings({
                          ...settings,
                          filler_words: {
                            ...settings.filler_words,
                            content: {
                              mode: "static",
                              static_config: {
                                ...settings.filler_words?.content?.static_config,
                                selection_rule: v as "shuffle" | "round_robin",
                              },
                            },
                          },
                        })
                      }
                      options={[
                        { value: "shuffle", label: "Shuffle" },
                        { value: "round_robin", label: "Round robin" },
                      ]}
                    />
                  </FormField>
                </>
              )}
            </CollapsibleSubSection>

            <CollapsibleSubSection
              title="Features"
              description="SAL, RTM, Tools"
              isOpen={advancedSubsections.features}
              onToggle={() => toggleAdvancedSubsection("features")}
            >
              <Toggle
                label="Enable SAL"
                checked={settings.advanced_features?.enable_sal ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    advanced_features: {
                      ...settings.advanced_features,
                      enable_sal: checked,
                    },
                  })
                }
                hint="Selective Attention Locking (SAL). Configure the sal field for speaker recognition or locking modes."
              />
              {(settings.advanced_features?.enable_sal ?? false) && (
                <div className="ml-0 mt-3 pl-0">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SAL configuration
                  </h4>
                  <FormField
                    label="SAL mode"
                    tooltip="locking or recognition."
                  >
                    <CustomSelect
                      value={settings.sal?.sal_mode ?? "locking"}
                      onChange={(v) =>
                        setSettings({
                          ...settings,
                          sal: {
                            ...settings.sal,
                            sal_mode: v as "locking" | "recognition",
                            sample_urls: settings.sal?.sample_urls ?? {},
                          },
                        })
                      }
                      options={[
                        { value: "locking", label: "Locking" },
                        { value: "recognition", label: "Recognition" },
                      ]}
                    />
                  </FormField>
                  <FormField
                    label="Voiceprint name (optional)"
                    hint="e.g. speaker1; must not be 'unknown'"
                  >
                    <Input
                      value={
                        Object.keys(settings.sal?.sample_urls ?? {})[0] ?? ""
                      }
                      onChange={(e) => {
                        const name = e.target.value.trim();
                        const urls = settings.sal?.sample_urls ?? {};
                        const currentUrl = Object.values(urls)[0] ?? "";
                        const next = name && name !== "unknown" ? { [name]: currentUrl } : {};
                        setSettings({
                          ...settings,
                          sal: { ...settings.sal, sample_urls: next },
                        });
                      }}
                      placeholder="speaker1"
                    />
                  </FormField>
                  <FormField
                    label="Voiceprint URL (optional)"
                    hint="16kHz 16-bit mono PCM .pcm, 10–15s, max 2MB"
                  >
                    <Input
                      value={
                        Object.values(settings.sal?.sample_urls ?? {})[0] ?? ""
                      }
                      onChange={(e) => {
                        const url = e.target.value.trim();
                        const name = Object.keys(settings.sal?.sample_urls ?? {})[0] ?? "speaker1";
                        const next =
                          name && name !== "unknown"
                            ? { [name]: url }
                            : url
                              ? { speaker1: url }
                              : {};
                        setSettings({
                          ...settings,
                          sal: { ...settings.sal, sample_urls: next },
                        });
                      }}
                      placeholder="https://example.com/speaker1.pcm"
                    />
                  </FormField>
                </div>
              )}
              <Toggle
                label="Enable RTM"
                checked={settings.advanced_features?.enable_rtm ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    advanced_features: {
                      ...settings.advanced_features,
                      enable_rtm: checked,
                    },
                  })
                }
                hint="Enables Signaling; use RTM for transcripts, state, chat."
              />
              <Toggle
                label="Enable Tools"
                checked={settings.advanced_features?.enable_tools ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    advanced_features: {
                      ...settings.advanced_features,
                      enable_tools: checked,
                    },
                  })
                }
                hint="Function calling support."
              />
              <Toggle
                label="Enable MLLM (voice-to-voice)"
                checked={settings.advanced_features?.enable_mllm ?? false}
                onChange={(checked) =>
                  setSettings({
                    ...settings,
                    advanced_features: {
                      ...settings.advanced_features,
                      enable_mllm: checked,
                    },
                    mllm: settings.mllm ?? {
                      style: "openai",
                      api_key: "",
                      params: {},
                      turn_detection: { provider: "openai" },
                    },
                  })
                }
                hint="OpenAI Realtime / Gemini Live voice-to-voice. v2.6: vendor-specific turn detection under mllm.turn_detection."
              />
              {(settings.advanced_features?.enable_mllm ?? false) && (
                <div className="mt-3 pl-0 space-y-3">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    MLLM configuration
                  </h4>
                  <FormField
                    label="Provider"
                    hint="openai = OpenAI Realtime; gemini = Google Gemini Live"
                  >
                    <CustomSelect
                      value={settings.mllm?.style ?? "openai"}
                      onChange={(v) => {
                        const style = v as "openai" | "gemini";
                        setSettings({
                          ...settings,
                          mllm: {
                            ...settings.mllm,
                            style,
                            turn_detection: {
                              ...settings.mllm?.turn_detection,
                              provider: style,
                            },
                          },
                        });
                      }}
                      options={[
                        { value: "openai", label: "OpenAI Realtime" },
                        { value: "gemini", label: "Google Gemini Live" },
                      ]}
                    />
                  </FormField>
                  <FormField
                    label="API Key"
                    hint="Leave empty to use server key (OPENAI_API_KEY / GEMINI_API_KEY)"
                  >
                    <Input
                      type="password"
                      value={maskKeyForDisplay(settings.mllm?.api_key)}
                      onChange={(e) =>
                        keyChange(e.target.value, settings.mllm?.api_key, (k) =>
                          setSettings({
                            ...settings,
                            mllm: { ...settings.mllm, api_key: k },
                          }),
                        )
                      }
                      placeholder="Leave empty for server key"
                    />
                  </FormField>
                  <FormField
                    label="Endpoint URL"
                    hint="Optional override (provider default if blank)"
                  >
                    <Input
                      value={settings.mllm?.url ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mllm: { ...settings.mllm, url: e.target.value },
                        })
                      }
                      placeholder="https://api.openai.com/v1/realtime"
                    />
                  </FormField>
                  <FormField
                    label="Greeting message"
                    hint="What the MLLM voice says first"
                  >
                    <Input
                      value={settings.mllm?.greeting_message ?? ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          mllm: {
                            ...settings.mllm,
                            greeting_message: e.target.value,
                          },
                        })
                      }
                      placeholder="Hello! How can I help you?"
                    />
                  </FormField>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    v2.6: vendor-specific turn detection (OpenAI Realtime
                    server_vad/semantic_vad, Gemini Live activity detection)
                    will be sent under <code>mllm.turn_detection</code> when
                    populated. Set provider above; details can be tuned via the
                    join payload editor.
                  </p>
                </div>
              )}
            </CollapsibleSubSection>
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors duration-300">
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2.5 bg-agora-accent-blue hover:opacity-90 text-white font-medium rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center mt-3">
            Fields marked with{" "}
            <span className="text-red-500 dark:text-red-400">*</span> are
            required
          </p>
        </div>
      </div>
    </>
  );
};

export default AgentSettingsSidebar;
