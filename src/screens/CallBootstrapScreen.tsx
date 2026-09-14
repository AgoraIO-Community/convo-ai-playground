"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { createRtcSession } from "@/api/agoraApi";
import { useAgora } from "@/hooks/useAgora";
import { getTranscriptTransport } from "@/lib/agora/transcriptTransport";
import useAppStore from "@/store/useAppStore";
import TeacherDemoLandingScreen, {
  type TeacherLandingPhase,
} from "@/screens/TeacherDemoLandingScreen";
import VideoCallScreen from "@/screens/VideoCallScreen";

type BootstrapStatus = "landing" | "joining" | "active" | "error";

const CallBootstrapScreen: React.FC = () => {
  const callActive = useAppStore((state) => state.callActive);
  const callStart = useAppStore((state) => state.callStart);
  const agentSettings = useAppStore((state) => state.agentSettings);
  const { joinMeeting } = useAgora();
  const hasStartedRef = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<BootstrapStatus>(
    callActive ? "active" : "landing",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (callActive) {
      setStatus("active");
      return;
    }

    if (status !== "joining" || !agentSettings || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const bootstrap = async (): Promise<void> => {
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
  }, [agentSettings, attempt, callActive, callStart, joinMeeting, status]);

  const handleEnter = useCallback((): void => {
    if (status === "joining") return;
    hasStartedRef.current = false;
    setErrorMessage("");
    setStatus("joining");
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, [status]);

  const handleRetry = useCallback((): void => {
    hasStartedRef.current = false;
    setErrorMessage("");
    setStatus("joining");
    setAttempt((currentAttempt) => currentAttempt + 1);
  }, []);

  const handleSignOut = useCallback((): void => {
    void signOut({ callbackUrl: "/" });
  }, []);

  if (status === "active") return <VideoCallScreen />;
  const landingPhase: TeacherLandingPhase = status;

  return (
    <TeacherDemoLandingScreen
      phase={landingPhase}
      errorMessage={errorMessage}
      onEnter={handleEnter}
      onRetry={handleRetry}
      onSignOut={handleSignOut}
    />
  );
};

export default CallBootstrapScreen;
