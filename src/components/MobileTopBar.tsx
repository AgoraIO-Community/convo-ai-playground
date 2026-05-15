"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MdWbSunny,
  MdDarkMode,
  MdTimer,
  MdHelpOutline,
  MdMoreVert,
  MdSubtitles,
} from "react-icons/md";
import useAppStore from "@/store/useAppStore";
import MeetingAuthHeader from "@/components/MeetingAuthHeader";

interface MobileTopBarProps {
  meetingName: string | null;
  channelId: string | null;
  remainingLabel: string | null;
  isAgentActive: boolean;
  transcriptionMode: string;
  onStartTour: () => void;
  onOpenTranscript: () => void;
}

const MobileTopBar: React.FC<MobileTopBarProps> = ({
  meetingName,
  channelId,
  remainingLabel,
  isAgentActive,
  transcriptionMode,
  onStartTour,
  onOpenTranscript,
}) => {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const title = meetingName || channelId || "Meeting";

  return (
    <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 shadow-md transition-colors duration-300">
      <div className="flex-1 min-w-0">
        <span
          data-tour="tour-meeting-name"
          className="block font-semibold text-sm font-syne truncate"
          title={title}
        >
          {title}
        </span>
      </div>

      {remainingLabel && (
        <span
          data-tour="tour-session-timer"
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-300 dark:bg-gray-700 text-xs font-medium tabular-nums shrink-0"
          title="Session timer"
        >
          <MdTimer
            className="w-3.5 h-3.5 text-[var(--agora-accent-blue)] shrink-0"
            aria-hidden
          />
          {remainingLabel}
        </span>
      )}

      {isAgentActive && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            transcriptionMode === "rtm"
              ? "bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400"
              : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
          }`}
        >
          {transcriptionMode.toUpperCase()}
        </span>
      )}

      <button
        onClick={onOpenTranscript}
        className="p-1.5 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--agora-accent-blue)] shrink-0"
        title="Open transcript"
        aria-label="Open transcript"
      >
        <MdSubtitles size={18} />
      </button>

      <button
        data-tour="tour-theme-toggle"
        onClick={toggleTheme}
        className="p-1.5 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--agora-accent-blue)] shrink-0"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <MdWbSunny size={18} className="text-yellow-400" />
        ) : (
          <MdDarkMode size={18} className="text-gray-700" />
        )}
      </button>

      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-full bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--agora-accent-blue)]"
          aria-label="More header actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MdMoreVert size={18} />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-2"
          >
            <button
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onStartTour();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <MdHelpOutline size={18} />
              Take the tour
            </button>
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <MeetingAuthHeader inline />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTopBar;
