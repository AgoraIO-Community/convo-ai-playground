/**
 * Skeleton loading screen shown during the transition from
 * Authenticated session bootstrap to the Video Call screen. Mirrors the
 * VideoCallScreen layout (left Live Transcript panel + video area + controls)
 * with shimmer effects so the user sees a seamless "preparing your meeting"
 * experience instead of a white flash.
 *
 * Pure HTML + Tailwind — no hooks or client state — so it works
 * as both a Server Component (loading.tsx) and a Client Component
 * (dynamic() fallback).
 */

function ShimmerBlock({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent animate-skeleton-shimmer"
        style={delay ? { animationDelay: `${delay}s` } : undefined}
      />
    </div>
  );
}

export default function MeetingLoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
      {/* ── Top Bar ── */}
      <div className="flex items-center bg-gray-200 dark:bg-gray-800 p-4 shadow-md transition-colors duration-300">
        {/* Meeting title */}
        <ShimmerBlock
          className="h-7 w-48 rounded-md bg-gray-300 dark:bg-gray-700"
          delay={0}
        />

        <div className="ml-auto flex items-center gap-3">
          {/* Timer badge */}
          <ShimmerBlock
            className="h-8 w-20 rounded-lg bg-gray-300 dark:bg-gray-700"
            delay={0.2}
          />
          {/* Theme toggle */}
          <ShimmerBlock
            className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700"
            delay={0.4}
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar: Live Transcript skeleton (matches VideoCallScreen default) */}
        <div
          className="shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 hidden sm:flex flex-col shadow-inner transition-colors duration-300 overflow-hidden"
          style={{ width: 350, minWidth: 350, maxWidth: 350 }}
        >
          {/* Transcript header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="min-w-0">
              <ShimmerBlock
                className="h-5 w-32 rounded bg-gray-300 dark:bg-gray-700 mb-2"
                delay={0}
              />
              <ShimmerBlock
                className="h-5 w-24 rounded-full bg-gray-300 dark:bg-gray-700"
                delay={0.1}
              />
            </div>
          </div>
          {/* Render mode bar */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
            <ShimmerBlock
              className="h-4 w-20 rounded bg-gray-300 dark:bg-gray-700"
              delay={0.2}
            />
            <div className="flex gap-1">
              <ShimmerBlock
                className="h-7 w-7 rounded bg-gray-300 dark:bg-gray-700"
                delay={0.25}
              />
              <ShimmerBlock
                className="h-7 w-7 rounded bg-gray-300 dark:bg-gray-700"
                delay={0.3}
              />
              <ShimmerBlock
                className="h-7 w-10 rounded bg-gray-300 dark:bg-gray-700"
                delay={0.35}
              />
            </div>
          </div>
          {/* Transcript content area */}
          <div className="flex-1 overflow-hidden px-4 py-4 bg-gray-50 dark:bg-gray-900/50 min-w-0">
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 space-y-2">
              <ShimmerBlock
                className="h-4 w-44 rounded bg-gray-300 dark:bg-gray-700"
                delay={0.4}
              />
              <ShimmerBlock
                className="h-3 w-56 rounded bg-gray-300 dark:bg-gray-700"
                delay={0.5}
              />
            </div>
          </div>
        </div>

        {/* Video area */}
        <div className="flex-1 flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
          <div className="w-[70%] max-w-4xl aspect-video">
            <div className="relative bg-gray-300 dark:bg-gray-950 rounded-lg overflow-hidden h-full w-full flex flex-col items-center justify-center shadow-lg">
              {/* Avatar circle */}
              <ShimmerBlock
                className="w-20 h-20 rounded-full bg-gray-400/40 dark:bg-gray-700/60 mb-4"
              />

              {/* Status text */}
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium animate-pulse">
                Preparing your meeting...
              </p>

              {/* Name label (bottom-left) */}
              <div className="absolute bottom-3 left-3">
                <ShimmerBlock
                  className="h-6 w-28 rounded-md bg-gray-400/30 dark:bg-gray-800/70"
                  delay={0.5}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Controls Bar ── */}
      <div className="flex justify-center items-center h-20 bg-gray-200 dark:bg-gray-800 px-4 shadow-lg transition-colors duration-300">
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Control button placeholders */}
          {[0, 1, 2, 3].map((i) => (
            <ShimmerBlock
              key={i}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gray-300 dark:bg-gray-700"
              delay={i * 0.15}
            />
          ))}
          {/* End call button (red tint) */}
          <ShimmerBlock
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-200 dark:bg-red-900/40"
            delay={0.9}
          />
        </div>
      </div>
    </div>
  );
}
