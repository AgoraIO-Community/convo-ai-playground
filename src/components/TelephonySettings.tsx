"use client";

import React from "react";
import { MdCall, MdInfoOutline, MdPhoneInTalk } from "react-icons/md";
import {
  getOutboundCallStatus,
  getTelephonyConfig,
  startOutboundCall,
} from "@/api/telephonyApi";
import { showToast } from "@/services/uiService";
import useAppStore from "@/store/useAppStore";
import type {
  OutboundCallOptions,
  OutboundCallStatus,
  TelephonyPublicConfig,
} from "@/types/telephony";

const E164_NUMBER = /^\+[1-9]\d{7,14}$/;
const DEFAULT_OPTIONS: OutboundCallOptions = {
  enableRecording: false,
  maxDurationSeconds: 300,
  maxSilenceDurationMs: 60000,
  maxRingDurationMs: 30000,
  idleTimeoutSeconds: 120,
};
const ACTIVE_CALL_STORAGE_KEY = "convoai-active-outbound-call";
const CALL_STATUS_POLL_INTERVAL_MS = 3000;
const POST_CALL_ARTIFACT_TIMEOUT_MS = 60000;

interface ActiveOutboundCall {
  callId: string;
  toNumber: string;
  startedAt: number;
  maxDurationSeconds: number;
  enableRecording: boolean;
  artifactPollingStartedAt?: number;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-agora-accent-blue focus:ring-2 focus:ring-agora-accent-blue/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

const TelephonySettings: React.FC = () => {
  const agentSettings = useAppStore((state) => state.agentSettings);
  const localUsername = useAppStore((state) => state.localUsername);
  const [config, setConfig] = React.useState<TelephonyPublicConfig | null>(null);
  const [toNumber, setToNumber] = React.useState("");
  const [options, setOptions] = React.useState(DEFAULT_OPTIONS);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeCall, setActiveCall] = React.useState<ActiveOutboundCall | null>(null);
  const [callStatus, setCallStatus] = React.useState<OutboundCallStatus | null>(null);
  const [statusError, setStatusError] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");
  const artifactPollingStartedAtRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getTelephonyConfig()
      .then((result) => {
        if (!cancelled) setConfig(result);
      })
      .catch(() => {
        if (!cancelled) setConfig({ configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const stored = window.sessionStorage.getItem(ACTIVE_CALL_STORAGE_KEY);
    if (!stored) return;
    try {
      const restored = JSON.parse(stored) as Partial<ActiveOutboundCall>;
      if (
        typeof restored.callId === "string" &&
        typeof restored.toNumber === "string" &&
        typeof restored.startedAt === "number" &&
        typeof restored.maxDurationSeconds === "number"
      ) {
        const active: ActiveOutboundCall = {
          callId: restored.callId,
          toNumber: restored.toNumber,
          startedAt: restored.startedAt,
          maxDurationSeconds: restored.maxDurationSeconds,
          enableRecording: restored.enableRecording === true,
          ...(typeof restored.artifactPollingStartedAt === "number"
            ? { artifactPollingStartedAt: restored.artifactPollingStartedAt }
            : {}),
        };
        setToNumber(active.toNumber);
        const trackingDeadline =
          active.startedAt + (active.maxDurationSeconds + 120) * 1000;
        if (Date.now() > trackingDeadline) {
          window.sessionStorage.removeItem(ACTIVE_CALL_STORAGE_KEY);
          return;
        }
        artifactPollingStartedAtRef.current =
          active.artifactPollingStartedAt ?? null;
        setCallStatus({ callId: active.callId, phase: "dialing" });
        setActiveCall(active);
      } else {
        window.sessionStorage.removeItem(ACTIVE_CALL_STORAGE_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(ACTIVE_CALL_STORAGE_KEY);
    }
  }, []);

  React.useEffect(() => {
    if (!activeCall) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const result = await getOutboundCallStatus(activeCall.callId);
        if (cancelled) return;
        setCallStatus(result);
        setStatusError("");
        if (result.phase === "completed" || result.phase === "failed") {
          const transcriptReady = result.transcript !== undefined;
          const recordingReady =
            !activeCall.enableRecording || Boolean(result.recordingUrl);
          if (transcriptReady && recordingReady) {
            window.sessionStorage.removeItem(ACTIVE_CALL_STORAGE_KEY);
            artifactPollingStartedAtRef.current = null;
            setActiveCall(null);
            return;
          }

          const artifactPollingStartedAt =
            artifactPollingStartedAtRef.current ?? Date.now();
          artifactPollingStartedAtRef.current = artifactPollingStartedAt;
          window.sessionStorage.setItem(
            ACTIVE_CALL_STORAGE_KEY,
            JSON.stringify({ ...activeCall, artifactPollingStartedAt }),
          );
          if (
            Date.now() - artifactPollingStartedAt >=
            POST_CALL_ARTIFACT_TIMEOUT_MS
          ) {
            window.sessionStorage.removeItem(ACTIVE_CALL_STORAGE_KEY);
            artifactPollingStartedAtRef.current = null;
            setActiveCall(null);
            return;
          }
        }
      } catch {
        if (cancelled) return;
        setStatusError("Call status is temporarily unavailable. Retrying…");
      }
      timer = setTimeout(poll, CALL_STATUS_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeCall]);

  const updateNumberOption = React.useCallback(
    (field: keyof Omit<OutboundCallOptions, "enableRecording">, value: string) => {
      setOptions((current) => ({ ...current, [field]: Number(value) }));
    },
    [],
  );

  const isValidNumber = E164_NUMBER.test(toNumber);
  const isTerminalCall =
    callStatus?.phase === "completed" || callStatus?.phase === "failed";
  const isCallInProgress =
    isSubmitting || (activeCall !== null && !isTerminalCall);
  const isPreparingArtifacts = activeCall !== null && isTerminalCall;
  const canSubmit =
    config?.configured === true &&
    Boolean(agentSettings) &&
    isValidNumber &&
    !isCallInProgress;

  const handleStartCall = React.useCallback(async () => {
    if (!agentSettings || !canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusError("");
    setCallStatus(null);
    try {
      const result = await startOutboundCall({
        toNumber,
        username: localUsername,
        agentSettings,
        options,
      });
      const active: ActiveOutboundCall = {
        callId: result.callId,
        toNumber,
        startedAt: Date.now(),
        maxDurationSeconds: options.maxDurationSeconds,
        enableRecording: options.enableRecording,
      };
      artifactPollingStartedAtRef.current = null;
      window.sessionStorage.setItem(
        ACTIVE_CALL_STORAGE_KEY,
        JSON.stringify(active),
      );
      setCallStatus({ callId: result.callId, phase: "dialing" });
      setActiveCall(active);
      showToast("Outbound call started", "success");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start outbound call";
      setErrorMessage(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }, [agentSettings, canSubmit, localUsername, options, toNumber]);

  return (
    <section className="space-y-5 px-6 py-5" aria-labelledby="telephony-heading">
      <div>
        <div className="flex items-center gap-2">
          <MdPhoneInTalk className="text-agora-accent-blue" size={22} />
          <h3 id="telephony-heading" className="text-base font-semibold text-gray-900 dark:text-white">
            Outbound telephony
          </h3>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Dial a PSTN number using this agent&apos;s current ASR, LLM, TTS, and MCP configuration.
        </p>
      </div>

      {config === null ? (
        <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Checking server configuration…
        </div>
      ) : config.configured ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <MdInfoOutline className="mt-0.5 shrink-0" size={18} />
          <span>
            Phone-number ID {config.phoneNumberId}. SIP routing is resolved from the number imported in Agora Console.
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Outbound telephony is not configured on this server. Set the Agent Studio base URL and Agora phone-number ID in the server environment.
        </div>
      )}

      <div>
        <label htmlFor="telephony-destination" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Destination phone number
        </label>
        <input
          id="telephony-destination"
          className={inputClass}
          type="tel"
          autoComplete="tel"
          placeholder="+918800112233"
          value={toNumber}
          disabled={isCallInProgress}
          onChange={(event) => setToNumber(event.target.value.trim())}
        />
        {toNumber && !isValidNumber && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            Use E.164 format, including + and the country code.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Maximum duration (seconds)" value={options.maxDurationSeconds} min={1} max={3600} disabled={isCallInProgress} onChange={(value) => updateNumberOption("maxDurationSeconds", value)} />
        <NumberField label="Idle timeout (seconds)" value={options.idleTimeoutSeconds} min={1} max={3600} disabled={isCallInProgress} onChange={(value) => updateNumberOption("idleTimeoutSeconds", value)} />
        <NumberField label="Silence timeout (ms)" value={options.maxSilenceDurationMs} min={1000} max={300000} disabled={isCallInProgress} onChange={(value) => updateNumberOption("maxSilenceDurationMs", value)} />
        <NumberField label="Ring timeout (ms)" value={options.maxRingDurationMs} min={1000} max={120000} disabled={isCallInProgress} onChange={(value) => updateNumberOption("maxRingDurationMs", value)} />
      </div>

      <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={options.enableRecording}
          disabled={isCallInProgress}
          onChange={(event) =>
            setOptions((current) => ({
              ...current,
              enableRecording: event.target.checked,
            }))
          }
          className="h-4 w-4 accent-agora-accent-blue"
        />
        Record this call
      </label>

      {!agentSettings && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Save an AI Agent configuration before starting an outbound call.
        </p>
      )}
      {errorMessage && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}
      {callStatus && <CallStatusCard status={callStatus} />}
      {isPreparingArtifacts && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Preparing recording and transcript…
        </p>
      )}
      {statusError && <p role="alert" className="text-sm text-amber-600 dark:text-amber-400">{statusError}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleStartCall}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-agora-accent-blue px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MdCall size={20} />
        {isSubmitting
          ? "Starting call…"
          : isCallInProgress
            ? "Call in progress"
            : "Start outbound call"}
      </button>
    </section>
  );
};

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: string) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, min, max, disabled, onChange }) => (
  <label className="text-sm text-gray-700 dark:text-gray-300">
    <span className="mb-1.5 block font-medium">{label}</span>
    <input
      className={inputClass}
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

const CallStatusCard: React.FC<{ status: OutboundCallStatus }> = ({ status }) => {
  const title = {
    dialing: "Dialing",
    live: "Live call",
    completed: "Call completed",
    failed: "Call failed",
  }[status.phase];
  const isTerminal = status.phase === "completed" || status.phase === "failed";
  const statusDotClass = {
    dialing: "bg-amber-500",
    live: "bg-agora-accent-blue",
    completed: "bg-emerald-500",
    failed: "bg-red-500",
  }[status.phase];
  const recordingPath = `/api/telephony/calls/${encodeURIComponent(status.callId)}/recording`;

  return (
    <div
      role="status"
      className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
          <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
          {title}
        </span>
        {!isTerminal && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${statusDotClass}`} />
            {status.phase === "live" ? "Connected" : "Connecting"}
          </span>
        )}
      </div>
      <p className="mt-1 break-all text-xs text-gray-500 dark:text-gray-400">Call ID: {status.callId}</p>
      {status.durationSeconds !== undefined && (
        <p className="mt-1 font-medium text-gray-900 dark:text-white">{status.durationSeconds} seconds</p>
      )}
      {(status.fromNumber || status.toNumber || status.callCategory) && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md bg-gray-50 p-2.5 text-xs dark:bg-gray-900/60">
          {status.fromNumber && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">From</dt>
              <dd className="text-right text-gray-800 dark:text-gray-200">{status.fromNumber}</dd>
            </>
          )}
          {status.toNumber && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">To</dt>
              <dd className="text-right text-gray-800 dark:text-gray-200">{status.toNumber}</dd>
            </>
          )}
          {status.callCategory && (
            <>
              <dt className="text-gray-500 dark:text-gray-400">Category</dt>
              <dd className="text-right text-gray-800 dark:text-gray-200">{status.callCategory.replace(/_/g, " ")}</dd>
            </>
          )}
        </dl>
      )}
      {status.hangupReason && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          Outcome: <span className="font-medium text-gray-900 dark:text-white">{status.hangupReason.replace(/_/g, " ")}</span>
        </p>
      )}
      {status.recordingUrl && (
        <section className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-900/60">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-semibold text-gray-900 dark:text-white">Recording</h4>
            <a
              aria-label="Download recording"
              className="text-xs font-medium text-agora-accent-blue hover:underline"
              href={recordingPath}
            >
              Download
            </a>
          </div>
          <audio
            aria-label="Call recording"
            className="mt-2 h-10 w-full"
            controls
            preload="metadata"
            src={`${recordingPath}?disposition=inline`}
          />
        </section>
      )}
      {status.transcript && (
        <section className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white">Call transcript</h4>
          {status.transcript.length > 0 ? (
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {status.transcript.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className="rounded-md bg-gray-50 p-2.5 text-gray-700 dark:bg-gray-900/60 dark:text-gray-200"
                >
                  <p className="text-xs font-semibold text-agora-accent-blue">
                    {transcriptRoleLabel(item.role)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{item.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No transcript content.</p>
          )}
        </section>
      )}
      {status.structuredOutput && status.structuredOutput.length > 0 && (
        <section className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white">Structured output</h4>
          <dl className="mt-2 space-y-2">
            {status.structuredOutput.map((item, index) => (
              <div key={index} className="rounded-md bg-gray-50 p-2.5 dark:bg-gray-900/60">
                <dt className="text-xs font-semibold">
                  {String(item.variable_name ?? `Result ${index + 1}`)}
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap">
                  {structuredOutputValue(item.value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};

function transcriptRoleLabel(role: string): string {
  if (role === "assistant" || role === "agent") return "AI Agent";
  if (role === "user") return "You";
  return role;
}

function structuredOutputValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "—";
  return JSON.stringify(value, null, 2);
}

export default TelephonySettings;
