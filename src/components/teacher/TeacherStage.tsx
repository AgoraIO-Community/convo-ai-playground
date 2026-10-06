"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef } from "react";
import type { IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import { MdDeleteOutline, MdPause, MdPlayArrow, MdSchool } from "react-icons/md";
import TeacherAvatarPiP from "@/components/teacher/TeacherAvatarPiP";
import type { TeacherBoardHandle } from "@/components/teacher/TeacherBoard";
import type { UseTeacherBoardSessionResult } from "@/hooks/useTeacherBoardSession";
import { EAgentState } from "@/types/agora";
import type {
  TeacherLessonProgress,
  TeacherLessonStatus,
} from "@/types/teacher";

const TeacherBoard = dynamic(
  () => import("@/components/teacher/TeacherBoard"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[360px] w-full animate-pulse rounded-[22px] border border-cyan-300/15 bg-[#07110f]" />
    ),
  },
);

interface TeacherStageProps {
  active: boolean;
  teacher: UseTeacherBoardSessionResult;
  agentId?: string | null;
  agentName: string;
  agentState: EAgentState;
  transcriptionMode: "rtc" | "rtm";
  avatarVideoTrack?: IRemoteVideoTrack | null;
  avatarExpected?: boolean;
  teacherStarting?: boolean;
  lessonStatus?: TeacherLessonStatus;
  lessonProgress?: TeacherLessonProgress | null;
  onClearBoard?: () => void;
  variant?: "interactive" | "preview";
  previewAvatarImageSrc?: string;
  avatarAspectRatio?: "1x1" | "2x3" | "9x16";
  avatarPlacement?: "overlay" | "side";
}

function overlayAvatarFrameClass(
  aspectRatio: TeacherStageProps["avatarAspectRatio"],
  compact: boolean,
): string {
  if (compact) {
    return "aspect-[3/2] w-[clamp(170px,24vw,260px)] max-w-[30%]";
  }
  if (aspectRatio === "1x1") {
    return "aspect-square w-[clamp(156px,24vw,300px)] max-w-[42%]";
  }
  if (aspectRatio === "2x3") {
    return "aspect-[2/3] h-[clamp(220px,52vh,440px)] max-h-[72%] w-auto max-w-[38%]";
  }
  if (aspectRatio === "9x16") {
    return "aspect-[9/16] h-[clamp(240px,56vh,460px)] max-h-[74%] w-auto max-w-[34%]";
  }
  return "aspect-[4/3] w-[clamp(156px,25vw,320px)] max-w-[46%]";
}

function sideRailClass(
  aspectRatio: TeacherStageProps["avatarAspectRatio"],
): string {
  if (aspectRatio === "9x16") {
    return "lg:w-[clamp(150px,15vw,220px)]";
  }
  if (aspectRatio === "2x3") {
    return "lg:w-[clamp(170px,17vw,250px)]";
  }
  return "lg:w-[clamp(200px,20vw,290px)]";
}

function sideAvatarFrameClass(
  aspectRatio: TeacherStageProps["avatarAspectRatio"],
): string {
  const sizing = "h-full max-w-full lg:h-auto lg:w-full";
  if (aspectRatio === "1x1") return `aspect-square ${sizing}`;
  if (aspectRatio === "2x3") return `aspect-[2/3] ${sizing}`;
  if (aspectRatio === "9x16") return `aspect-[9/16] ${sizing}`;
  return `aspect-[4/3] ${sizing}`;
}

function statusFor(
  teacher: UseTeacherBoardSessionResult,
  lessonStatus: TeacherLessonStatus,
  lessonProgress: TeacherLessonProgress | null,
  variant: "interactive" | "preview",
  teacherStarting: boolean,
): {
  label: string;
  dot: string;
} {
  if (variant === "preview") {
    return { label: "Live lesson preview", dot: "bg-cyan-300" };
  }
  if (teacherStarting) {
    return { label: "Connecting teacher", dot: "bg-cyan-300 animate-pulse" };
  }
  if (lessonStatus === "planning") {
    return { label: "Planning lesson", dot: "bg-violet-300 animate-pulse" };
  }
  if (lessonStatus === "writing") {
    return {
      label: lessonProgress
        ? `Writing · ${lessonProgress.current} of ${lessonProgress.total}`
        : "Writing on board",
      dot: "bg-amber-300 animate-pulse",
    };
  }
  if (lessonStatus === "explaining") {
    return {
      label: lessonProgress
        ? `Explaining · ${lessonProgress.current} of ${lessonProgress.total}`
        : "Explaining",
      dot: "bg-emerald-300 animate-pulse",
    };
  }
  if (lessonStatus === "clarifying") {
    return {
      label: lessonProgress
        ? `Answering question · ${lessonProgress.current} of ${lessonProgress.total}`
        : "Answering question",
      dot: "bg-violet-300 animate-pulse",
    };
  }
  if (lessonStatus === "paused") {
    return { label: "Paused · say continue", dot: "bg-amber-300" };
  }
  if (lessonStatus === "interrupted") {
    return { label: "Interrupted", dot: "bg-amber-300" };
  }
  if (lessonStatus === "unavailable") {
    return { label: "Teacher unavailable", dot: "bg-rose-300" };
  }
  if (lessonStatus === "error") {
    return { label: "Lesson error", dot: "bg-rose-300" };
  }
  if (teacher.connection === "demo") {
    return { label: "Prototype lesson", dot: "bg-amber-300" };
  }
  if (teacher.connection === "connecting") {
    return { label: "Preparing board", dot: "bg-cyan-300 animate-pulse" };
  }
  if (teacher.connection === "offline") {
    return { label: "Board offline · voice continues", dot: "bg-rose-300" };
  }
  if (teacher.session?.liveMcpConfigured) {
    return { label: "Live board ready", dot: "bg-emerald-300" };
  }
  return { label: "Local prototype ready", dot: "bg-cyan-300" };
}

const TeacherStage: React.FC<TeacherStageProps> = ({
  active,
  teacher,
  agentId,
  agentName,
  agentState,
  transcriptionMode,
  avatarVideoTrack = null,
  avatarExpected = false,
  teacherStarting = false,
  lessonStatus = "idle",
  lessonProgress = null,
  onClearBoard,
  variant = "interactive",
  previewAvatarImageSrc,
  avatarAspectRatio,
  avatarPlacement = "overlay",
}) => {
  const boardRef = useRef<TeacherBoardHandle>(null);
  const status = statusFor(
    teacher,
    lessonStatus,
    lessonProgress,
    variant,
    teacherStarting,
  );
  const isPreview = variant === "preview";
  const showAvatarBesideBoard = avatarPlacement === "side" && !isPreview;
  const canPlayDemo = !isPreview && !teacher.session?.liveMcpConfigured;

  const handlePlayDemo = useCallback(() => {
    boardRef.current?.cancelAnimation();
    void teacher.playDemo();
  }, [teacher]);

  const handlePauseDemo = useCallback(() => {
    boardRef.current?.cancelAnimation();
    teacher.pauseDemo();
  }, [teacher]);

  const handleClear = useCallback(() => {
    boardRef.current?.cancelAnimation();
    onClearBoard?.();
    teacher.clearBoard();
  }, [onClearBoard, teacher]);

  const avatar = (
    <TeacherAvatarPiP
      active={active}
      agentId={agentId}
      agentName={agentName}
      agentState={agentState}
      transcriptionMode={transcriptionMode}
      videoTrack={avatarVideoTrack}
      avatarExpected={avatarExpected}
      previewImageSrc={previewAvatarImageSrc}
    />
  );

  return (
    <section
      className={`relative flex h-full w-full min-h-0 ${
        showAvatarBesideBoard
          ? "flex-col gap-2 overflow-hidden lg:flex-row lg:gap-3"
          : "overflow-hidden"
      } ${
        isPreview
          ? "min-h-[300px] sm:min-h-[420px]"
          : "min-h-0"
      }`}
      aria-label="AI Teacher blackboard"
      data-testid="teacher-stage"
      data-teacher-elements={Object.keys(teacher.boardState.elements).length}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[26px] bg-[#020908] p-1.5 shadow-2xl sm:p-2"
          data-testid="teacher-board-surface"
        >
          <TeacherBoard
            ref={boardRef}
            state={teacher.boardState}
            animation={teacher.activeAnimation}
            active={active}
            canvasRightOffset={showAvatarBesideBoard ? 24 : 250}
          />

          <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur-xl sm:left-6 sm:top-6">
            <MdSchool className="text-base text-cyan-300" />
            AI Teacher
          </div>

          <div
            className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-lg backdrop-blur-xl sm:right-6 sm:top-6 sm:text-xs"
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full motion-reduce:animate-none ${status.dot}`}
            />
            {status.label}
          </div>

          {!showAvatarBesideBoard && (
            <aside
              className={`absolute bottom-4 right-4 z-30 overflow-hidden rounded-2xl border border-cyan-200/35 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)] sm:bottom-5 sm:right-5 ${overlayAvatarFrameClass(avatarAspectRatio, isPreview)}`}
              aria-label="AI teacher picture in picture"
            >
              {avatar}
            </aside>
          )}
        </div>

        {!isPreview && (
          <div
            className="flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-2.5 shadow-lg backdrop-blur-xl"
            data-testid="teacher-board-actions"
          >
            {canPlayDemo && (
              <button
                type="button"
                onClick={handlePlayDemo}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-cyan-200/20 bg-slate-900/80 px-3 text-xs font-semibold text-cyan-50 transition hover:border-cyan-200/40 hover:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <MdPlayArrow className="text-base" />
                Play demo lesson
              </button>
            )}
            {teacher.connection === "demo" && (
              <button
                type="button"
                onClick={handlePauseDemo}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-900/80 text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                aria-label="Pause demo lesson"
                title="Pause demo lesson"
              >
                <MdPause />
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-slate-900/80 text-slate-300 transition hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300"
              aria-label="Clear blackboard"
              title="Clear blackboard"
            >
              <MdDeleteOutline />
            </button>
          </div>
        )}
      </div>

      {showAvatarBesideBoard && (
        <aside
          className={`flex h-[132px] w-full shrink-0 items-end justify-end lg:h-full ${sideRailClass(avatarAspectRatio)}`}
          aria-label="AI teacher video panel"
        >
          <div
            className={`overflow-hidden rounded-2xl border border-cyan-200/35 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)] ${sideAvatarFrameClass(avatarAspectRatio)}`}
          >
            {avatar}
          </div>
        </aside>
      )}
    </section>
  );
};

export default TeacherStage;
