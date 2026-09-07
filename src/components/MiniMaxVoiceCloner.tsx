"use client";

import React, { useEffect, useRef, useState } from "react";
import { MdMic, MdStop, MdUploadFile } from "react-icons/md";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const ACCEPTED_AUDIO = ".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav";

type CloneStatus = "idle" | "uploading" | "ready" | "error";

interface MiniMaxVoiceClonerProps {
  model: string;
  voiceId: string;
  onVoiceCloned: (voiceId: string) => void;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(audio: AudioBuffer): Blob {
  const sampleRate = audio.sampleRate;
  const sampleCount = audio.length;
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * bytesPerSample, true);

  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  );
  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const mixed =
      channels.reduce((sum, channel) => sum + channel[sampleIndex], 0) /
      channels.length;
    const clamped = Math.max(-1, Math.min(1, mixed));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function recordingToSupportedFile(blob: Blob): Promise<File> {
  if (blob.type.includes("mp4")) {
    return new File([blob], "minimax-voice-sample.m4a", { type: "audio/mp4" });
  }

  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("This browser cannot convert the recording to WAV.");
  }
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return new File([encodeWav(decoded)], "minimax-voice-sample.wav", {
      type: "audio/wav",
    });
  } finally {
    await context.close();
  }
}

const MiniMaxVoiceCloner: React.FC<MiniMaxVoiceClonerProps> = ({
  model,
  voiceId,
  onVoiceCloned,
}) => {
  const [cloneVoiceId, setCloneVoiceId] = useState(voiceId);
  const [previewText, setPreviewText] = useState(
    "Hello! This is a preview of my cloned voice.",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<CloneStatus>("idle");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef(0);

  useEffect(() => {
    setCloneVoiceId(voiceId);
  }, [voiceId]);

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
      const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
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
      recorder.addEventListener("stop", async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        const duration = (Date.now() - recordingStartedAtRef.current) / 1000;
        if (duration < 10) {
          setError("Record at least 10 seconds for MiniMax voice cloning.");
          return;
        }
        try {
          const rawRecording = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const supportedFile = await recordingToSupportedFile(rawRecording);
          setSelectedFile(supportedFile);
          setError("");
        } catch (conversionError) {
          setError(
            conversionError instanceof Error
              ? conversionError.message
              : "Could not prepare this recording.",
          );
        }
      });
      recorder.start(250);
    } catch {
      setError("Microphone access was denied. Upload an audio file instead.");
    }
  };

  const cloneVoice = async (): Promise<void> => {
    setError("");
    setPreviewUrl("");
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
      form.set("voiceId", cloneVoiceId.trim());
      form.set("previewText", previewText.trim());
      form.set("model", model || "speech-2.8-turbo");
      const response = await fetch("/api/tts/minimax/voice-clone", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        error?: string;
        voiceId?: string;
        previewUrl?: string;
      };
      if (!response.ok || !body.voiceId) {
        throw new Error(body.error || "MiniMax voice cloning failed.");
      }

      onVoiceCloned(body.voiceId);
      setCloneVoiceId(body.voiceId);
      setPreviewUrl(body.previewUrl ?? "");
      setStatus("ready");
    } catch (cloneError) {
      setStatus("error");
      setError(
        cloneError instanceof Error
          ? cloneError.message
          : "MiniMax voice cloning failed.",
      );
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-agora-accent-blue/25 bg-agora-accent-blue/[0.04] p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Clone a voice
        </h4>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
          Record 10 seconds to 5 minutes, or upload MP3, M4A, or WAV (20 MB maximum).
          The sample is sent directly to MiniMax and is not stored by this app.
        </p>
      </div>

      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300" htmlFor="minimax-clone-voice-id">
        Clone voice ID
      </label>
      <input
        id="minimax-clone-voice-id"
        value={cloneVoiceId}
        onChange={(event) => setCloneVoiceId(event.target.value)}
        placeholder="MyVoice01"
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
              const file = event.target.files?.[0] ?? null;
              setSelectedFile(file);
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

      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300" htmlFor="minimax-preview-text">
        Preview text
      </label>
      <textarea
        id="minimax-preview-text"
        rows={2}
        maxLength={1000}
        value={previewText}
        onChange={(event) => setPreviewText(event.target.value)}
        className="mb-3 w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />

      <label className="mb-3 flex items-start gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 accent-agora-accent-blue"
        />
        I confirm that I own this voice or have explicit permission to clone it.
      </label>

      <button
        type="button"
        onClick={cloneVoice}
        disabled={status === "uploading" || isRecording}
        className="w-full rounded-lg bg-agora-accent-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading and cloning…" : "Clone voice"}
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
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {cloneVoiceId} is now selected for MiniMax TTS.
          </p>
          {previewUrl ? (
            <audio
              aria-label="Cloned voice preview"
              className="mt-2 w-full"
              controls
              src={previewUrl}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default MiniMaxVoiceCloner;
