"use client";

import React from "react";

export type AgentGlyphSize =
  | "compact"
  | "control"
  | "navigation"
  | "stage";

export interface AgentGlyphProps {
  size?: AgentGlyphSize;
  className?: string;
  decorative?: boolean;
}

const sizeClasses: Record<AgentGlyphSize, string> = {
  compact: "h-4 w-4",
  control: "h-5 w-5",
  navigation: "h-[18px] w-[18px]",
  stage: "h-12 w-12 sm:h-16 sm:w-16",
};

const AgentGlyph: React.FC<AgentGlyphProps> = ({
  size = "compact",
  className = "",
  decorative = true,
}) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className={`${sizeClasses[size]} ${className}`}
    data-testid="agent-glyph"
    aria-hidden={decorative ? true : undefined}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : "AI agent"}
  >
    <path
      d="M8 24c4.6-7.7 9.9-11.6 16-11.6S35.4 16.3 40 24c-4.6 7.7-9.9 11.6-16 11.6S12.6 31.7 8 24Z"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.42"
    />
    <path
      d="M13.5 24c3.2-5 6.7-7.5 10.5-7.5S31.3 19 34.5 24c-3.2 5-6.7 7.5-10.5 7.5S16.7 29 13.5 24Z"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.76"
    />
    <path
      d="M19 24h2.4l1.7-4 2.4 8 1.6-4H29"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default AgentGlyph;
