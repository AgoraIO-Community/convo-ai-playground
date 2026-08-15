"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { createRtcSession } from "@/api/agoraApi";
import MeetingLoadingSkeleton from "@/components/MeetingLoadingSkeleton";
import { useAgora } from "@/hooks/useAgora";
import { getTranscriptTransport } from "@/lib/agora/transcriptTransport";
import useAppStore from "@/store/useAppStore";
import VideoCallScreen from "@/screens/VideoCallScreen";

type BootstrapStatus = "joining" | "active" | "error";

const CallBootstrapScreen: React.FC = () => {
  const callActive = useAppStore((state) => state.callActive);
  const callStart = useAppStore((state) => state.callStart);
  const agentSettings = useAppStore((state) => state.agentSettings);
  const { joinMeeting } = useAgora();
  const hasStartedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<BootstrapStatus>(
    callActive ? "active" : "joining",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (callActive) {
      setStatus("active");
      return;
    }

    if (!agentSettings) return;

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const bootstrap = async (): Promise<void> => {
      setStatus("joining");
      setErrorMessage("");

      try {
        const session = await createRtcSession();
        await joinMeeting(
          session,
          getTranscriptTransport(agentSettings) === "rtm",
        );
        callStart({
          displayName: session.displayName,
          rtcUid: String(session.rtcUid),
          channelName: session.channelName,
          startedAt: Date.now(),
        });
        setStatus("active");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to start the call",
        );
        setStatus("error");
      }
    };

    void bootstrap();
  }, [agentSettings, attempt, callActive, callStart, joinMeeting]);

  const handleRetry = useCallback((): void => {
    hasStartedRef.current = false;
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const handleSignOut = useCallback((): void => {
    void signOut({ callbackUrl: "/" });
  }, []);

  if (status === "active") return <VideoCallScreen />;
  if (status === "joining") return <MeetingLoadingSkeleton />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
          Call setup failed
        </p>
        <h1 className="mt-3 text-2xl font-semibold">We could not connect your call</h1>
        <p className="mt-3 text-sm text-slate-300">{errorMessage}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-white/20 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
};

export default CallBootstrapScreen;
