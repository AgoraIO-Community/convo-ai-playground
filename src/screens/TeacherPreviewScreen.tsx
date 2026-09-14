"use client";

import { MdCallEnd, MdMic, MdSchool, MdSettings, MdTimer } from "react-icons/md";
import CallExperienceModeSwitch from "@/components/CallExperienceModeSwitch";
import TeacherStage from "@/components/teacher/TeacherStage";
import { useTeacherBoardSession } from "@/hooks/useTeacherBoardSession";
import { EAgentState } from "@/types/agora";

export default function TeacherPreviewScreen() {
  const teacher = useTeacherBoardSession(EAgentState.SPEAKING);
  const roundButton =
    "grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/10 text-xl text-white";

  return (
    <div className="flex h-screen-dvh flex-col overflow-hidden bg-slate-950 text-white">
      <header className="flex min-h-16 items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">Private agent call</p>
          <p className="text-xs text-slate-400">Teacher Mode · development preview</p>
        </div>
        <CallExperienceModeSwitch value="teacher" onChange={() => undefined} />
        <span className="hidden rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 sm:inline-flex">
          RTM live
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium tabular-nums">
          <MdTimer className="text-cyan-300" /> 14:32
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[350px] shrink-0 border-r border-white/10 bg-slate-900 p-4 md:block">
          <h2 className="text-lg font-semibold">Live Transcript</h2>
          <div className="mt-2 inline-flex rounded-full bg-emerald-400/15 px-2 py-1 text-[11px] font-semibold text-emerald-300">
            Transmission: RTM
          </div>
          <div className="mt-8 space-y-4 text-sm">
            <div className="rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3 text-slate-300">
              <span className="font-semibold text-cyan-200">AI Teacher</span>
              <p className="mt-1">Let’s see how plants turn sunlight into stored energy.</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-slate-400">
              <span className="font-semibold text-slate-200">You</span>
              <p className="mt-1">Can you draw the process on the board?</p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 sm:p-5">
          <div className="mx-auto h-full w-full max-w-7xl">
            <TeacherStage
              active
              teacher={teacher}
              agentId="prototype-agent"
              agentName="Maya"
              agentState={EAgentState.SPEAKING}
              transcriptionMode="rtm"
            />
          </div>
        </main>
      </div>

      <footer className="flex min-h-20 items-center justify-center border-t border-white/10 bg-slate-950/95 px-2 py-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <button className={roundButton} aria-label="Mute microphone"><MdMic /></button>
          <button className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-2xl" aria-label="End call"><MdCallEnd /></button>
          <button className={`${roundButton} w-auto gap-2 px-3 text-sm font-semibold`} aria-label="Start agent">Start agent</button>
          <button className={`${roundButton} border-cyan-200/45 bg-cyan-300/20 text-cyan-100`} aria-label="Exit Teacher Mode" aria-pressed="true"><MdSchool /></button>
          <button className={roundButton} aria-label="Agent settings"><MdSettings /></button>
        </div>
      </footer>
    </div>
  );
}
