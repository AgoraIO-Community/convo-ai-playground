"use client";

import React from "react";
import { MdMicNone, MdVideocam } from "react-icons/md";
import type { CallExperienceMode } from "@/types/callExperience";

interface CallExperienceModeSwitchProps {
  value: CallExperienceMode;
  onChange: (mode: CallExperienceMode) => void;
  disabled?: boolean;
}

const choices: Array<{
  value: CallExperienceMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: "voice", label: "Voice Agent", icon: <MdMicNone aria-hidden /> },
  { value: "video", label: "Video Agent", icon: <MdVideocam aria-hidden /> },
];

const CallExperienceModeSwitch: React.FC<CallExperienceModeSwitchProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <div
    role="radiogroup"
    aria-label="Call experience"
    aria-busy={disabled}
    className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.06] p-1 shadow-inner"
  >
    {choices.map((choice) => {
      const selected = choice.value === value;
      return (
        <label
          key={choice.value}
          className={`relative flex cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm ${
            selected
              ? "bg-cyan-300/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.28)]"
              : "text-slate-400 hover:text-slate-200"
          } ${disabled ? "cursor-wait opacity-60" : ""}`}
        >
          <input
            type="radio"
            name="call-experience-mode"
            value={choice.value}
            checked={selected}
            disabled={disabled}
            onChange={() => {
              if (!disabled) onChange(choice.value);
            }}
            className="peer sr-only"
          />
          <span className="text-base peer-focus-visible:rounded-full peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-300 peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-slate-950">
            {choice.icon}
          </span>
          <span>{choice.label}</span>
        </label>
      );
    })}
  </div>
);

export default CallExperienceModeSwitch;
