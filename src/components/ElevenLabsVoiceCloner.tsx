"use client";

import React, { useEffect, useRef, useState } from "react";
import { MdMic, MdStop, MdUploadFile } from "react-icons/md";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const ACCEPTED_AUDIO =
  ".mp3,.m4a,.mp4,.wav,.webm,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg";

type CloneStatus = "idle" | "uploading" | "ready" | "error";

export interface ElevenLabsClonedVoice {
  voiceId: string;
  name: string;
}

interface ElevenLabsVoiceClonerProps {
  apiKey: string;
  model: string;
  onVoiceCloned: (voice: ElevenLabsClonedVoice) => void;
}

const DEFAULT_PREVIEW_TEXT = "Hello! This is a preview of my cloned voice.";

function recordingExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function usableApiKey(apiKey: string): string {
  const key = apiKey.trim();
  return key === "***MASKED***" || key === "__USE_SERVER__" ? "" : key;
}

const ElevenLabsVoiceCloner: React.FC<ElevenLabsVoiceClonerProps> = ({
  apiKey,
  model,
  onVoiceCloned,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState(
    "Created in the ConvoAI Playground",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeBackgroundNoise, setRemoveBackgroundNoise] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<CloneStatus>("idle");
  const [error, setError] = useState("");
  const [createdVoiceId, setCreatedVoiceId] = useState("");
  const [previewText, setPreviewText] = useState(DEFAULT_PREVIEW_TEXT);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const stopRecording = (): void => {
    recorderRef.current?.stop();
  };

  const startRecording = async (): Promise<void> => {
    setError("");
    setStatus("idle");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. Upload a file instead.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(
          Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
        );
      }, 500);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      recorder.addEventListener("stop", () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const duration = (Date.now() - recordingStartedAtRef.current) / 1000;
        if (duration < 10) {
          setError("Record at least 10 seconds; 1–2 minutes produces a better clone.");
          return;
        }
        const type = recorder.mimeType || "audio/webm";
        const recording = new File(
          [new Blob(chunksRef.current, { type })],
          `elevenlabs-voice-sample.${recordingExtension(type)}`,
          { type },
        );
        setSelectedFile(recording);
        setError("");
      });
      recorder.start(250);
    } catch {
      setError("Microphone access was denied. Upload an audio file instead.");
    }
  };

  const cloneVoice = async (): Promise<void> => {
    setError("");
    setCreatedVoiceId("");
    setPreviewUrl("");
    setPreviewError("");
    const voiceName = name.trim();
    if (!voiceName) {
      setError("Enter a name for the cloned voice.");
      return;
    }
    if (!selectedFile) {
      setError("Choose or record a voice sample first.");
      return;
    }
    if (selectedFile.size > MAX_AUDIO_BYTES) {
      setError("Voice samples must be 20 MB or smaller.");
      return;
    }
    if (!consent) {
      setError("Confirm that you have permission to clone this voice.");
      return;
    }

    setStatus("uploading");
    try {
      const form = new FormData();
      form.set("file", selectedFile);
      form.set("name", voiceName);
      form.set("description", description.trim());
      form.set("removeBackgroundNoise", String(removeBackgroundNoise));
      form.set("model", model.trim());
      form.set("previewText", previewText.trim());
      const currentKey = usableApiKey(apiKey);
      if (currentKey) form.set("apiKey", currentKey);

      const response = await fetch("/api/tts/elevenlabs/voice-clone", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
        voiceId?: string;
        requiresVerification?: boolean;
        previewUrl?: string;
        previewError?: string;
      };
      if (!response.ok || !body.voiceId) {
        throw new Error(body.error || "ElevenLabs voice cloning failed.");
      }

      onVoiceCloned({ voiceId: body.voiceId, name: voiceName });
      setCreatedVoiceId(body.voiceId);
      setPreviewUrl(body.previewUrl ?? "");
      setPreviewError(body.previewError ?? "");
      setStatus("ready");
    } catch (cloneError) {
      setStatus("error");
      setError(
        cloneError instanceof Error
          ? cloneError.message
          : "ElevenLabs voice cloning failed.",
      );
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-agora-accent-blue/25 bg-agora-accent-blue/[0.04] p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          ElevenLabs Instant Voice Cloning
        </h4>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
          Record or upload 1–2 minutes of clean, single-speaker audio. MP3, M4A,
          WAV, or WebM works best under 20 MB. The sample is forwarded to
          ElevenLabs and is not stored by this app.
        </p>
      </div>

      <label
        className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
        htmlFor="elevenlabs-clone-name"
      >
        Voice name
      </label>
      <input
        id="elevenlabs-clone-name"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        placeholder="My cloned voice"
        className="mb-3 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />

      <label
        className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
        htmlFor="elevenlabs-clone-description"
      >
        Description
      </label>
      <input
        id="elevenlabs-clone-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Optional description"
        className="mb-3 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:border-agora-accent-blue dark:border-gray-600 dark:text-gray-200">
          <MdUploadFile size={17} />
          Upload sample
          <input
            className="sr-only"
            type="file"
            aria-label="Voice sample"
            accept={ACCEPTED_AUDIO}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setStatus("idle");
              setError("");
            }}
          />
        </label>
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            isRecording
              ? "bg-red-500 text-white hover:bg-red-600"
              : "border border-gray-300 text-gray-700 hover:border-agora-accent-blue dark:border-gray-600 dark:text-gray-200"
          }`}
        >
          {isRecording ? <MdStop size={17} /> : <MdMic size={17} />}
          {isRecording ? `Stop recording (${recordingSeconds}s)` : "Record voice"}
        </button>
      </div>

      {selectedFile ? (
        <p className="mb-3 truncate text-xs text-gray-600 dark:text-gray-300">
          Selected: {selectedFile.name}
        </p>
      ) : null}

      <label className="mb-3 flex items-start gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={removeBackgroundNoise}
          onChange={(event) => setRemoveBackgroundNoise(event.target.checked)}
          className="mt-1 accent-agora-accent-blue"
        />
        Remove background noise (leave off for already-clean recordings).
      </label>

      <label className="mb-3 flex items-start gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 accent-agora-accent-blue"
        />
        I confirm that I own this voice or have explicit permission to clone it.
      </label>

      <label
        className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
        htmlFor="elevenlabs-preview-text"
      >
        Preview text
      </label>
      <textarea
        id="elevenlabs-preview-text"
        value={previewText}
        maxLength={300}
        rows={2}
        onChange={(event) => setPreviewText(event.target.value)}
        className="mb-3 w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />

      <button
        type="button"
        onClick={cloneVoice}
        disabled={status === "uploading" || isRecording}
        className="w-full rounded-lg bg-agora-accent-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "uploading"
          ? "Cloning and preparing preview…"
          : "Clone voice"}
      </button>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {status === "ready" ? (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Voice ready
          </p>
          <p className="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-300">
            {createdVoiceId}
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            The cloned voice is now selected for ElevenLabs TTS.
          </p>
          {previewUrl ? (
            <audio
              aria-label="Cloned voice preview"
              className="mt-3 w-full"
              controls
              preload="metadata"
              src={previewUrl}
            />
          ) : null}
          {previewError ? (
            <p
              role="status"
              className="mt-2 text-xs text-amber-700 dark:text-amber-300"
            >
              Voice cloning succeeded, but {previewError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ElevenLabsVoiceCloner;
