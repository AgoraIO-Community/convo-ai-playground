"use client";

import { useEffect } from "react";
import {
  MdArrowForward,
  MdAutoAwesome,
  MdGraphicEq,
  MdLogout,
  MdOutlineTouchApp,
  MdSchool,
} from "react-icons/md";
import TeacherStage from "@/components/teacher/TeacherStage";
import { useTeacherBoardSession } from "@/hooks/useTeacherBoardSession";
import { EAgentState } from "@/types/agora";

export type TeacherLandingPhase = "landing" | "joining" | "error";

interface TeacherDemoLandingScreenProps {
  phase: TeacherLandingPhase;
  errorMessage?: string;
  onEnter(): void;
  onRetry(): void;
  onSignOut(): void;
}

const capabilities = [
  { label: "Speak naturally", icon: MdGraphicEq },
  { label: "Interrupt anytime", icon: MdOutlineTouchApp },
  { label: "Visual explanations", icon: MdAutoAwesome },
] as const;

const TeacherDemoLandingScreen: React.FC<TeacherDemoLandingScreenProps> = ({
  phase,
  errorMessage,
  onEnter,
  onRetry,
  onSignOut,
}) => {
  const teacher = useTeacherBoardSession(EAgentState.SPEAKING, {
    connectRemote: false,
  });
  const playDemo = teacher.playDemo;
  const pauseDemo = teacher.pauseDemo;

  useEffect(() => {
    let cancelled = false;
    let replayTimer: number | null = null;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const waitForReplay = (): Promise<void> =>
      new Promise((resolve) => {
        replayTimer = window.setTimeout(resolve, 1600);
      });

    const runPreview = async (): Promise<void> => {
      await playDemo();
      if (reduceMotion) return;

      while (!cancelled) {
        await waitForReplay();
        if (cancelled) return;
        await playDemo();
      }
    };

    void runPreview();
    return () => {
      cancelled = true;
      if (replayTimer !== null) window.clearTimeout(replayTimer);
      pauseDemo();
    };
  }, [pauseDemo, playDemo]);

  const isJoining = phase === "joining";
  const isError = phase === "error";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#02050c] text-white selection:bg-cyan-300 selection:text-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,0.15),transparent_30%),radial-gradient(circle_at_80%_72%,rgba(79,70,229,0.16),transparent_36%),linear-gradient(135deg,#02050c_0%,#040817_48%,#02050c_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-[100px] motion-safe:animate-pulse motion-reduce:animate-none"
      />

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] items-center gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[0.76fr_1.24fr] lg:px-10 xl:gap-14 xl:px-16">
        <section className="flex min-w-0 flex-col items-start lg:py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-cyan-200 shadow-[0_0_32px_rgba(34,211,238,0.08)]">
            <MdSchool aria-hidden className="text-base" />
            AI Teacher
          </div>

          <div className="mt-6 max-w-2xl lg:mt-7">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
              The classroom, reimagined
            </p>
            <h1 className="font-[Georgia,ui-serif,serif] text-[clamp(2.8rem,4.8vw,5.8rem)] leading-[0.88] font-normal tracking-[-0.055em] text-slate-50">
              Teach anything.
              <span className="mt-2 block bg-gradient-to-r from-cyan-200 via-sky-300 to-indigo-300 bg-clip-text italic text-transparent">
                Make it visible.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              A conversational teacher that listens, explains, and builds the
              lesson on a living blackboard—one idea at a time.
            </p>
          </div>

          <ul className="mt-5 flex max-w-xl flex-wrap gap-2.5" aria-label="AI Teacher capabilities">
            {capabilities.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3.5 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm"
              >
                <Icon aria-hidden className="text-base text-cyan-300" />
                {label}
              </li>
            ))}
          </ul>

          {isError ? (
            <div
              role="alert"
              className="mt-4 w-full max-w-xl rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-100"
            >
              <p className="font-semibold">The classroom could not connect.</p>
              <p className="mt-1 text-rose-100/75">
                {errorMessage || "Please try joining again."}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={isError ? onRetry : onEnter}
              disabled={isJoining}
              aria-busy={isJoining}
              className="group inline-flex min-h-13 flex-1 items-center justify-center gap-3 rounded-full bg-cyan-300 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-[0_12px_44px_rgba(34,211,238,0.2)] transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-200 hover:shadow-[0_18px_54px_rgba(34,211,238,0.28)] focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-4 focus:ring-offset-[#02050c] disabled:cursor-wait disabled:translate-y-0 disabled:bg-cyan-300/65 motion-reduce:transform-none motion-reduce:transition-none"
            >
              {isJoining ? (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/25 border-t-slate-950 motion-reduce:animate-none"
                />
              ) : null}
              {isJoining
                ? "Connecting classroom…"
                : isError
                  ? "Try again"
                  : "Enter the classroom"}
              {!isJoining ? (
                <MdArrowForward
                  aria-hidden
                  className="text-lg transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none"
                />
              ) : null}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30 motion-reduce:transition-none"
            >
              <MdLogout aria-hidden />
              Sign out
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
            <span aria-hidden className="h-px w-8 bg-gradient-to-r from-cyan-300/70 to-transparent" />
            Powered by Agora Conversational AI
          </div>
        </section>

        <section className="relative min-w-0 pb-3 lg:py-4" aria-label="Live classroom demonstration">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-[44px] bg-cyan-300/[0.045] blur-3xl"
          />
          <div className="relative">
            <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              <span>Live classroom preview</span>
              <span className="inline-flex items-center gap-2 text-cyan-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-pulse motion-reduce:animate-none" />
                Drawing now
              </span>
            </div>
            <div className="relative aspect-[16/10] min-h-[320px] overflow-hidden rounded-[30px] border border-cyan-200/20 bg-[#020908] p-1 shadow-[0_32px_120px_rgba(8,145,178,0.18),0_0_0_1px_rgba(255,255,255,0.025)] sm:min-h-[440px]">
              <TeacherStage
                active
                variant="preview"
                teacher={teacher}
                agentName="Maya"
                agentState={EAgentState.SPEAKING}
                transcriptionMode="rtm"
                previewAvatarImageSrc="/images/ai-teacher-maya.jpg"
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-600 sm:text-xs">
              <span>01 · Listen</span>
              <span className="text-center">02 · Visualize</span>
              <span className="text-right">03 · Understand</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default TeacherDemoLandingScreen;
