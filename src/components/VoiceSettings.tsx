"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MdMic, MdRefresh, MdCheckCircle, MdWarning, MdPlayArrow, MdStop } from "react-icons/md";
import useAppStore from "@/store/useAppStore";
import { setVoiceSettings } from "@/services/settingsDb";
import type { AudioDevice } from "@/types/agora";
import type { IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

interface VoiceSettingsProps {
  localMicrophoneTrack: {
    setDevice: (deviceId: string) => Promise<void>;
    getTrackLabel: () => string;
    getVolumeLevel: () => number;
  } | null;
}

// Styled select (matching AgentSettingsSidebar)
const Select: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }
> = ({ error, className = "", children, ...props }) => (
  <select
    {...props}
    className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white text-sm
      focus:outline-none focus:ring-2 focus:ring-agora-accent-blue dark:focus:ring-agora-accent-blue transition-colors
      ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"}
      ${className}`}
  >
    {children}
  </select>
);

// Form field wrapper
const FormField: React.FC<{
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, required, children, hint }) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
      {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1.5">{hint}</p>}
  </div>
);

// Audio level meter component
const AudioLevelMeter: React.FC<{ level: number }> = ({ level }) => {
  const percentage = Math.min(100, Math.max(0, level * 100));

  return (
    <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-75 rounded-full ${
          percentage > 70
            ? "bg-green-500"
            : percentage > 30
            ? "bg-agora-accent-blue"
            : "bg-gray-400 dark:bg-gray-500"
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const VoiceSettings: React.FC<VoiceSettingsProps> = ({ localMicrophoneTrack }) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const selectedMicrophoneId = useAppStore((state) => state.selectedMicrophoneId);
  const setSelectedMicrophoneId = useAppStore((state) => state.setSelectedMicrophoneId);

  const animationFrameRef = useRef<number | null>(null);
  const testTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Fetch available microphones
  const fetchMicrophones = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      const microphones = await AgoraRTC.getMicrophones();

      const formattedDevices: AudioDevice[] = microphones.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}...`,
        kind: "audioinput" as const,
      }));

      setDevices(formattedDevices);
      setPermissionGranted(microphones.some((d) => d.label && d.label !== ""));

      // If no device selected, use current track's device if available (store is hydrated from IndexedDB on load)
      if (!selectedMicrophoneId && formattedDevices.length > 0 && localMicrophoneTrack) {
        const currentLabel = localMicrophoneTrack.getTrackLabel();
        const currentDevice = microphones.find((d) => d.label === currentLabel);
        if (currentDevice) {
          setSelectedMicrophoneId(currentDevice.deviceId);
        }
      }
    } catch (err) {
      console.error("Error fetching microphones:", err);
      setError("Failed to fetch microphone devices. Please grant microphone permission.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMicrophoneId, setSelectedMicrophoneId, localMicrophoneTrack]);

  // Initialize on mount
  useEffect(() => {
    fetchMicrophones();
  }, [fetchMicrophones]);

  // Setup device change listener for hot-swap detection
  useEffect(() => {
    const setupDeviceChangeListener = async () => {
      try {
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

        AgoraRTC.onMicrophoneChanged = async (changedDevice) => {
          console.log("Microphone changed:", changedDevice);
          await fetchMicrophones();

          // If a new device was plugged in and we have an active track, optionally switch to it
          if (changedDevice.state === "ACTIVE" && localMicrophoneTrack) {
            // Don't auto-switch, just refresh the list
          } else if (
            changedDevice.state === "INACTIVE" &&
            changedDevice.device.deviceId === selectedMicrophoneId
          ) {
            // Current device was unplugged, switch to first available
            const microphones = await AgoraRTC.getMicrophones();
            if (microphones[0] && localMicrophoneTrack) {
              const newId = microphones[0].deviceId;
              await localMicrophoneTrack.setDevice(newId);
              setSelectedMicrophoneId(newId);
              setVoiceSettings({ selectedMicrophoneId: newId }).catch((err) =>
                console.error("[VoiceSettings] Failed to persist voice settings:", err),
              );
            }
          }
        };
      } catch (err) {
        console.error("Error setting up device listener:", err);
      }
    };

    setupDeviceChangeListener();

    return () => {
      import("agora-rtc-sdk-ng").then(({ default: AgoraRTC }) => {
        AgoraRTC.onMicrophoneChanged = undefined;
      });
    };
  }, [localMicrophoneTrack, selectedMicrophoneId, setSelectedMicrophoneId, fetchMicrophones]);

  // Handle device selection change
  const handleDeviceChange = async (deviceId: string) => {
    setSelectedMicrophoneId(deviceId);
    setVoiceSettings({ selectedMicrophoneId: deviceId }).catch((err) =>
      console.error("[VoiceSettings] Failed to persist voice settings:", err),
    );

    if (localMicrophoneTrack) {
      try {
        await localMicrophoneTrack.setDevice(deviceId);
        console.log("Microphone device changed to:", deviceId);
      } catch (err) {
        console.error("Error changing microphone device:", err);
        setError("Failed to switch microphone device.");
      }
    }
  };

  // Start microphone test with recording
  const startMicTest = async () => {
    setIsTesting(true);
    setAudioLevel(0);
    setRecordedAudioUrl(null);
    audioChunksRef.current = [];

    try {
      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;

      // Create a temporary track for testing
      const testTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: selectedMicrophoneId || undefined,
      });

      testTrackRef.current = testTrack;

      // Get the MediaStreamTrack for recording
      const mediaStreamTrack = testTrack.getMediaStreamTrack();
      const mediaStream = new MediaStream([mediaStreamTrack]);

      // Set up Web Audio API for accurate volume level monitoring
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      const source = audioContext.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Set up MediaRecorder for playback
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      // Start monitoring audio level using Web Audio API AnalyserNode
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate RMS (root mean square) for accurate volume level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);

          // Normalize to 0-1 range (255 is max value for Uint8Array)
          const normalizedLevel = rms / 255;

          setAudioLevel(normalizedLevel);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (err) {
      console.error("Error starting mic test:", err);
      setError("Failed to start microphone test. Please check permissions.");
      setIsTesting(false);
    }
  };

  // Stop microphone test
  const stopMicTest = () => {
    // Stop the animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Close the audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Close the track
    if (testTrackRef.current) {
      testTrackRef.current.close();
      testTrackRef.current = null;
    }

    setIsTesting(false);
    setAudioLevel(0);
  };

  // Play recorded audio
  const playRecordedAudio = () => {
    if (recordedAudioUrl && audioPlayerRef.current) {
      audioPlayerRef.current.src = recordedAudioUrl;
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  // Stop playback
  const stopPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // Close track
      if (testTrackRef.current) {
        testTrackRef.current.close();
      }
      // Stop playback
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, []);

  // Clean up recorded audio URL when it changes
  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  const currentDevice = devices.find((d) => d.deviceId === selectedMicrophoneId);

  return (
    <div className="space-y-6">
      {/* Microphone Selection */}
      <FormField
        label="Microphone"
        required
        hint={permissionGranted ? "Select your preferred microphone device" : "Grant microphone permission to see device names"}
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <Select
              value={selectedMicrophoneId || ""}
              onChange={(e) => handleDeviceChange(e.target.value)}
              disabled={isLoading || devices.length === 0}
            >
              {isLoading ? (
                <option value="">Loading devices...</option>
              ) : devices.length === 0 ? (
                <option value="">No microphones found</option>
              ) : (
                <>
                  <option value="">Select a microphone</option>
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </>
              )}
            </Select>
          </div>
          <button
            onClick={fetchMicrophones}
            disabled={isLoading}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh device list"
          >
            <MdRefresh className={`text-gray-600 dark:text-gray-300 ${isLoading ? "animate-spin" : ""}`} size={20} />
          </button>
        </div>
      </FormField>

      {/* Current Device Status */}
      {currentDevice && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <MdCheckCircle className="text-green-600 dark:text-green-400" size={18} />
          <span className="text-sm text-green-700 dark:text-green-300">
            Using: {currentDevice.label}
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <MdWarning className="text-red-600 dark:text-red-400" size={18} />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {/* Audio Level Meter */}
      <FormField label="Audio Level" hint="Speak into your microphone to test">
        <AudioLevelMeter level={audioLevel} />
      </FormField>

      {/* Test Microphone Button */}
      <div className="flex flex-col gap-3">
        <button
          onClick={isTesting ? stopMicTest : startMicTest}
          disabled={(!selectedMicrophoneId && devices.length > 0) || isPlaying}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
            isTesting
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-agora-accent-blue hover:opacity-90 text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isTesting ? <MdStop size={20} /> : <MdMic size={20} />}
          {isTesting ? "Stop Recording" : "Test Microphone"}
        </button>

        {isTesting && (
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Speak now - the audio level bar should respond to your voice
          </p>
        )}

        {/* Playback Button - shows after recording */}
        {!isTesting && recordedAudioUrl && (
          <button
            onClick={isPlaying ? stopPlayback : playRecordedAudio}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
              isPlaying
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white"
            }`}
          >
            {isPlaying ? <MdStop size={20} /> : <MdPlayArrow size={20} />}
            {isPlaying ? "Stop Playback" : "Play Recording"}
          </button>
        )}

        {!isTesting && recordedAudioUrl && !isPlaying && (
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            Click play to hear your recorded audio
          </p>
        )}
      </div>

      {/* Hidden audio player */}
      <audio
        ref={audioPlayerRef}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Permission Request Info */}
      {!permissionGranted && devices.length > 0 && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>Tip:</strong> Click &quot;Test Microphone&quot; to grant permission and see full device names.
          </p>
        </div>
      )}
    </div>
  );
};

export default VoiceSettings;
