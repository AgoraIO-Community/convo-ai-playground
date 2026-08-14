"use client";

import React, { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import ToastContainer from "@/components/common/ToastContainer";
import useAppStore from "@/store/useAppStore";
import {
  getAgentSettings,
  setAgentSettings as persistAgentSettings,
  getVoiceSettings,
  setVoiceSettings,
} from "@/services/settingsDb";
import { getDefaultSettings } from "@/components/SettingsSidebar";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((state) => state.theme);
  const setAgentSettings = useAppStore((state) => state.setAgentSettings);
  const setSelectedMicrophoneId = useAppStore(
    (state) => state.setSelectedMicrophoneId,
  );
  const hydratedRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const hydrate = async () => {
      try {
        const [agent, voice] = await Promise.all([
          getAgentSettings(),
          getVoiceSettings(),
        ]);
        if (agent) {
          setAgentSettings(agent);
        } else {
          // First-time use: initialize with defaults so agent can start
          // without requiring the user to open settings panel first
          const defaults = getDefaultSettings();
          setAgentSettings(defaults);
          await persistAgentSettings(defaults);
        }
        if (voice?.selectedMicrophoneId != null) {
          setSelectedMicrophoneId(voice.selectedMicrophoneId);
        } else if (
          typeof localStorage !== "undefined" &&
          localStorage.getItem("selectedMicrophoneId")
        ) {
          const savedId = localStorage.getItem("selectedMicrophoneId");
          if (savedId) {
            setSelectedMicrophoneId(savedId);
            await setVoiceSettings({ selectedMicrophoneId: savedId });
            localStorage.removeItem("selectedMicrophoneId");
          }
        }
      } catch (err) {
        console.error("[Providers] Settings hydration failed:", err);
      }
    };

    hydrate();
  }, [setAgentSettings, setSelectedMicrophoneId]);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer />
      </QueryClientProvider>
    </SessionProvider>
  );
}
