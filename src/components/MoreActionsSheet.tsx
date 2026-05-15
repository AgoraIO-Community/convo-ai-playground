"use client";

import React from "react";
import {
  MdMonitor,
  MdClose,
  MdDraw,
  MdShare,
  MdSettings,
  MdPeople,
  MdAutoAwesome,
  MdStop,
  MdSync,
} from "react-icons/md";
import BottomSheet from "@/components/common/BottomSheet";

interface MoreAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "default" | "accent" | "danger";
  hidden?: boolean;
}

interface MoreActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;
  isWhiteboardActive: boolean;
  onToggleWhiteboard: () => void;
  onShareMeeting: () => void;
  onOpenParticipants?: () => void;
  isHost: boolean;
  isAgentActive: boolean;
  isAgentLoading: boolean;
  isAgentUpdating: boolean;
  onToggleAgent: () => void;
  onOpenAgentSettings: () => void;
}

const MoreActionsSheet: React.FC<MoreActionsSheetProps> = ({
  isOpen,
  onClose,
  isScreenSharing,
  onToggleScreenShare,
  isWhiteboardActive,
  onToggleWhiteboard,
  onShareMeeting,
  onOpenParticipants,
  isHost,
  isAgentActive,
  isAgentLoading,
  isAgentUpdating,
  onToggleAgent,
  onOpenAgentSettings,
}) => {
  const runAndClose = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const actions: MoreAction[] = [
    {
      key: "agent-toggle",
      label: isAgentUpdating
        ? "Updating"
        : isAgentLoading
          ? isAgentActive
            ? "Stopping"
            : "Starting"
          : isAgentActive
            ? "Stop Agent"
            : "Start Agent",
      icon:
        isAgentUpdating || isAgentLoading ? (
          <MdSync className="animate-spin" />
        ) : isAgentActive ? (
          <MdStop />
        ) : (
          <MdAutoAwesome />
        ),
      onClick: runAndClose(onToggleAgent),
      active: isAgentActive,
      disabled: isAgentLoading || isAgentUpdating,
      hidden: !isHost,
      tone: "accent",
    },
    {
      key: "agent-settings",
      label: "Agent Settings",
      icon: <MdSettings />,
      onClick: runAndClose(onOpenAgentSettings),
      hidden: !isHost,
    },
    {
      key: "screen-share",
      label: isScreenSharing ? "Stop Share" : "Screen Share",
      icon: isScreenSharing ? <MdClose /> : <MdMonitor />,
      onClick: runAndClose(onToggleScreenShare),
      active: isScreenSharing,
    },
    {
      key: "whiteboard",
      label: isWhiteboardActive ? "Close Board" : "Whiteboard",
      icon: <MdDraw />,
      onClick: runAndClose(onToggleWhiteboard),
      active: isWhiteboardActive,
    },
    {
      key: "participants",
      label: "Participants",
      icon: <MdPeople />,
      onClick: onOpenParticipants ? runAndClose(onOpenParticipants) : () => {},
      hidden: !onOpenParticipants,
    },
    {
      key: "share",
      label: "Share Link",
      icon: <MdShare />,
      onClick: runAndClose(onShareMeeting),
    },
  ];

  const visible = actions.filter((a) => !a.hidden);

  const agentAction = visible.find((a) => a.key === "agent-toggle");
  const restActions = visible.filter((a) => a.key !== "agent-toggle");

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="More actions"
      snapPoints={[0.55, 0.85]}
      ariaLabelledBy="more-actions-title"
    >
      <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-3">
        {agentAction && (
          <button
            key={agentAction.key}
            onClick={agentAction.onClick}
            disabled={agentAction.disabled}
            className={`relative w-full flex items-center gap-3 px-4 py-4 rounded-xl text-base font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-agora disabled:opacity-60 overflow-hidden ${
              agentAction.active
                ? "bg-green-500 dark:bg-green-600 text-white"
                : isAgentLoading || isAgentUpdating
                  ? "bg-[var(--agora-accent-blue)] text-white"
                  : "bg-[var(--agora-accent-blue)] text-white hover:opacity-90 shadow-lg shadow-[var(--agora-accent-blue)]/30 ring-2 ring-white/20"
            }`}
          >
            {!agentAction.active && !isAgentLoading && !isAgentUpdating && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"
              />
            )}
            <span className="relative text-2xl leading-none">
              {agentAction.icon}
            </span>
            <span className="relative flex-1 text-left">
              {agentAction.label}
            </span>
            {!agentAction.active && !isAgentLoading && !isAgentUpdating && (
              <span
                aria-hidden
                className="relative inline-flex h-2 w-2 rounded-full bg-white animate-ping"
              />
            )}
          </button>
        )}

        <div className="grid grid-cols-3 gap-3">
          {restActions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              disabled={a.disabled}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-agora disabled:opacity-50 ${
                a.active
                  ? "bg-agora text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <span className="text-2xl leading-none">{a.icon}</span>
              <span className="text-xs text-center px-1 leading-tight">
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
};

export default MoreActionsSheet;
