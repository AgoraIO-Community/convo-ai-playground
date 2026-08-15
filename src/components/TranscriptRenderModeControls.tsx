"use client";

import { useId, type ReactNode } from "react";
import { MdTextFields, MdViewHeadline } from "react-icons/md";
import { ETranscriptRenderMode } from "@/types/agora";

interface TranscriptRenderModeControlsProps {
  value: ETranscriptRenderMode;
  onChange: (mode: ETranscriptRenderMode) => void;
}

interface RenderModeOption {
  mode: ETranscriptRenderMode;
  label: string;
  content: ReactNode;
}

const options: RenderModeOption[] = [
  {
    mode: ETranscriptRenderMode.TEXT,
    label: "Text — show complete transcript updates",
    content: <MdTextFields size={14} aria-hidden="true" />,
  },
  {
    mode: ETranscriptRenderMode.WORD,
    label: "Word — reveal words as spoken",
    content: <MdViewHeadline size={14} aria-hidden="true" />,
  },
  {
    mode: ETranscriptRenderMode.AUTO,
    label: "Auto — use word timing when available",
    content: "Auto",
  },
];

export function TranscriptRenderModeControls({
  value,
  onChange,
}: TranscriptRenderModeControlsProps) {
  const tooltipIdPrefix = useId();

  return (
    <div className="flex gap-1">
      {options.map((option) => {
        const selected = value === option.mode;
        const tooltipId = `${tooltipIdPrefix}-${option.mode}-tooltip`;

        return (
          <div key={option.mode} className="group relative">
            <button
              type="button"
              onClick={() => onChange(option.mode)}
              aria-label={option.label}
              aria-describedby={tooltipId}
              aria-pressed={selected}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                selected
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {option.content}
            </button>
            <span
              id={tooltipId}
              role="tooltip"
              aria-label={option.label}
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max -translate-x-1/2 rounded bg-gray-950 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {option.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
