"use client";

import React from "react";
import type {
  AgentSettings,
  MllmStyle,
  MllmTurnDetection,
  MllmTurnDetectionMode,
} from "@/types/agora";
import {
  getDefaultMllmSettings,
  getDefaultMllmTurnDetection,
  getDefaultOpenAiInputAudioTranscription,
  getMllmApiKeyEnvName,
  getMllmDefaultConfig,
  getMllmTurnDetectionModeOptions,
  MLLM_PROVIDER_OPTIONS,
  type OpenAiInputAudioTranscription,
} from "@/utils/mllmEnv";

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

function mllmEndpointHint(style: MllmStyle): string {
  if (style === "openai") return "OpenAI Realtime WebSocket";
  if (style === "gemini") return "Google Gemini Live WebSocket";
  return "xAI Grok Realtime WebSocket";
}

interface MllmSettingsPanelProps {
  settings: AgentSettings;
  setSettings: React.Dispatch<React.SetStateAction<AgentSettings>>;
  FormField: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
  }>;
  Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>>;
  Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>>;
  CustomSelect: React.FC<{
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
  }>;
}

const MllmSettingsPanel: React.FC<MllmSettingsPanelProps> = ({
  settings,
  setSettings,
  FormField,
  Input,
  Textarea,
  CustomSelect,
}) => {
  const mllmStyle = (settings.mllm?.style ?? "openai") as MllmStyle;
  const mllmTd =
    settings.mllm?.turn_detection ?? getDefaultMllmTurnDetection(mllmStyle);
  const mllmTdMode: MllmTurnDetectionMode = mllmTd.mode ?? "server_vad";
  const mllmParams = (settings.mllm?.params ?? {}) as Record<string, unknown>;
  const openAiTranscription = (mllmParams.input_audio_transcription ??
    getDefaultOpenAiInputAudioTranscription()) as OpenAiInputAudioTranscription;
  const serverVadDefaults = getDefaultMllmTurnDetection(mllmStyle, "server_vad")
    .server_vad_config;

  const updateMllmParams = (patch: Record<string, unknown>) => {
    setSettings((prev) => ({
      ...prev,
      mllm: {
        ...prev.mllm,
        params: { ...(prev.mllm?.params as Record<string, unknown>), ...patch },
      },
    }));
  };

  const updateOpenAiTranscription = (patch: Partial<OpenAiInputAudioTranscription>) => {
    setSettings((prev) => {
      const prevParams = (prev.mllm?.params ?? {}) as Record<string, unknown>;
      const prevTx = (prevParams.input_audio_transcription ??
        getDefaultOpenAiInputAudioTranscription()) as OpenAiInputAudioTranscription;
      return {
        ...prev,
        mllm: {
          ...prev.mllm,
          params: {
            ...prevParams,
            input_audio_transcription: { ...prevTx, ...patch },
          },
        },
      };
    });
  };

  const setMllmTurnDetection = (td: MllmTurnDetection) => {
    setSettings((prev) => ({
      ...prev,
      mllm: { ...prev.mllm, turn_detection: td },
    }));
  };

  return (
    <div className="mt-3 pl-0 space-y-3 border-t border-gray-200 dark:border-gray-600 pt-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        MLLM configuration
      </h4>
      <FormField
        label="Provider"
        hint="OpenAI Realtime, Google Gemini Live, or xAI Grok"
      >
        <CustomSelect
          value={mllmStyle}
          onChange={(v) => {
            const style = v as MllmStyle;
            setSettings((prev) => ({
              ...prev,
              mllm: getDefaultMllmSettings(style),
            }));
          }}
          options={MLLM_PROVIDER_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
          }))}
        />
      </FormField>
      <FormField
        label="API Key"
        hint={`Leave empty to use ${getMllmApiKeyEnvName(mllmStyle)} from .env`}
      >
        <Input
          type="password"
          value={maskKeyForDisplay(settings.mllm?.api_key)}
          onChange={(e) =>
            keyChange(e.target.value, settings.mllm?.api_key, (k) =>
              setSettings((prev) => ({
                ...prev,
                mllm: { ...prev.mllm, api_key: k },
              })),
            )
          }
          placeholder="Leave empty for server key"
        />
      </FormField>
      <FormField label="Endpoint URL" hint={mllmEndpointHint(mllmStyle)}>
        <Input
          value={settings.mllm?.url ?? getMllmDefaultConfig(mllmStyle).url}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              mllm: { ...prev.mllm, url: e.target.value },
            }))
          }
          placeholder={getMllmDefaultConfig(mllmStyle).url}
        />
      </FormField>
      {mllmStyle !== "xai" && (
        <FormField label="Model">
          <Input
            value={String(mllmParams.model ?? "")}
            onChange={(e) => updateMllmParams({ model: e.target.value })}
          />
        </FormField>
      )}
      <FormField label="Voice">
        <Input
          value={String(mllmParams.voice ?? "")}
          onChange={(e) => updateMllmParams({ voice: e.target.value })}
          placeholder={mllmStyle === "xai" ? "eve" : undefined}
        />
      </FormField>
      {mllmStyle === "xai" && (
        <>
          <FormField label="Language" hint="ISO-639-1 (e.g. en)">
            <Input
              value={String(mllmParams.language ?? "en")}
              onChange={(e) => updateMllmParams({ language: e.target.value })}
              placeholder="en"
            />
          </FormField>
          <FormField label="Sample rate (Hz)">
            <Input
              type="number"
              value={String(mllmParams.sample_rate ?? 24000)}
              onChange={(e) =>
                updateMllmParams({
                  sample_rate: parseInt(e.target.value, 10) || 24000,
                })
              }
            />
          </FormField>
        </>
      )}
      <FormField
        label="Instructions"
        hint={
          mllmStyle === "xai"
            ? "Sent as mllm.messages[0].content for xAI Grok"
            : "mllm.params.instructions (system prompt)"
        }
      >
        <Textarea
          value={String(mllmParams.instructions ?? "")}
          onChange={(e) => updateMllmParams({ instructions: e.target.value })}
          rows={4}
        />
      </FormField>
      {mllmStyle === "openai" && (
        <>
          <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide pt-1">
            Input audio transcription
          </h5>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            OpenAI Realtime — improves transcript accuracy and latency (
            <code className="text-[11px]">mllm.params.input_audio_transcription</code>
            ).
          </p>
          <FormField
            label="Language"
            hint="ISO-639-1 (e.g. en, es, fr). Agora / OpenAI recommendation."
          >
            <Input
              value={openAiTranscription.language ?? "en"}
              onChange={(e) => updateOpenAiTranscription({ language: e.target.value })}
              placeholder="en"
            />
          </FormField>
          <FormField label="Transcription model">
            <CustomSelect
              value={openAiTranscription.model ?? "gpt-4o-mini-transcribe"}
              onChange={(v) => updateOpenAiTranscription({ model: v })}
              options={[
                { value: "gpt-4o-mini-transcribe", label: "gpt-4o-mini-transcribe" },
                { value: "gpt-4o-transcribe", label: "gpt-4o-transcribe" },
                { value: "whisper-1", label: "whisper-1" },
              ]}
            />
          </FormField>
          <FormField
            label="Transcription prompt"
            hint="Style hint for gpt-4o transcribe models; keywords for whisper-1"
          >
            <Textarea
              value={openAiTranscription.prompt ?? ""}
              onChange={(e) => updateOpenAiTranscription({ prompt: e.target.value })}
              rows={2}
              placeholder="expect words related to real-time engagement"
            />
          </FormField>
        </>
      )}
      <FormField label="Greeting message">
        <Input
          value={settings.mllm?.greeting_message ?? ""}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              mllm: { ...prev.mllm, greeting_message: e.target.value },
            }))
          }
        />
      </FormField>
      <FormField label="Failure message">
        <Input
          value={settings.mllm?.failure_message ?? ""}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              mllm: { ...prev.mllm, failure_message: e.target.value },
            }))
          }
        />
      </FormField>

      <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide pt-2">
        MLLM turn detection
      </h5>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Uses <code className="text-[11px]">mllm.turn_detection</code> (not classic
        turn detection).
      </p>
      <FormField label="Mode">
        <CustomSelect
          value={mllmTdMode}
          onChange={(v) => {
            const mode = v as MllmTurnDetectionMode;
            setMllmTurnDetection(getDefaultMllmTurnDetection(mllmStyle, mode));
          }}
          options={getMllmTurnDetectionModeOptions(mllmStyle)}
        />
      </FormField>
      {mllmTdMode === "server_vad" && (
        <>
          <FormField label="Threshold (0–1)">
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={mllmTd.server_vad_config?.threshold ?? serverVadDefaults?.threshold ?? 0.5}
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "server_vad",
                  server_vad_config: {
                    ...mllmTd.server_vad_config,
                    threshold: parseFloat(e.target.value) || 0.5,
                  },
                })
              }
            />
          </FormField>
          <FormField label="Silence duration (ms)">
            <Input
              type="number"
              value={
                mllmTd.server_vad_config?.silence_duration_ms ??
                serverVadDefaults?.silence_duration_ms ??
                640
              }
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "server_vad",
                  server_vad_config: {
                    ...mllmTd.server_vad_config,
                    silence_duration_ms: parseInt(e.target.value, 10) || 640,
                  },
                })
              }
            />
          </FormField>
          <FormField label="Prefix padding (ms)">
            <Input
              type="number"
              value={
                mllmTd.server_vad_config?.prefix_padding_ms ??
                serverVadDefaults?.prefix_padding_ms ??
                800
              }
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "server_vad",
                  server_vad_config: {
                    ...mllmTd.server_vad_config,
                    prefix_padding_ms: parseInt(e.target.value, 10) || 800,
                  },
                })
              }
            />
          </FormField>
        </>
      )}
      {mllmTdMode === "agora_vad" && (
        <>
          <FormField label="Threshold (0–1)">
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={mllmTd.agora_vad_config?.threshold ?? 0.5}
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "agora_vad",
                  agora_vad_config: {
                    ...mllmTd.agora_vad_config,
                    threshold: parseFloat(e.target.value) || 0.5,
                  },
                })
              }
            />
          </FormField>
          <FormField label="Interrupt duration (ms)">
            <Input
              type="number"
              value={mllmTd.agora_vad_config?.interrupt_duration_ms ?? 160}
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "agora_vad",
                  agora_vad_config: {
                    ...mllmTd.agora_vad_config,
                    interrupt_duration_ms: parseInt(e.target.value, 10) || 160,
                  },
                })
              }
            />
          </FormField>
          <FormField label="Silence duration (ms)">
            <Input
              type="number"
              value={mllmTd.agora_vad_config?.silence_duration_ms ?? 640}
              onChange={(e) =>
                setMllmTurnDetection({
                  ...mllmTd,
                  mode: "agora_vad",
                  agora_vad_config: {
                    ...mllmTd.agora_vad_config,
                    silence_duration_ms: parseInt(e.target.value, 10) || 640,
                  },
                })
              }
            />
          </FormField>
        </>
      )}
      {mllmTdMode === "semantic_vad" && mllmStyle === "openai" && (
        <FormField label="Eagerness">
          <CustomSelect
            value={mllmTd.semantic_vad_config?.eagerness ?? "auto"}
            onChange={(v) =>
              setMllmTurnDetection({
                ...mllmTd,
                mode: "semantic_vad",
                semantic_vad_config: {
                  eagerness: v as "auto" | "low" | "medium" | "high",
                },
              })
            }
            options={[
              { value: "auto", label: "Auto" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </FormField>
      )}
    </div>
  );
};

export default MllmSettingsPanel;
