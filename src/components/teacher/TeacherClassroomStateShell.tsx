import type { ReactNode } from "react";
import {
  MdArrowForward,
  MdCropSquare,
  MdGesture,
  MdPanTool,
  MdSchool,
} from "react-icons/md";

interface TeacherClassroomStateShellProps {
  children: ReactNode;
  label: string;
  role?: "alert" | "status";
  tone?: "cyan" | "emerald" | "rose";
}

const toneClasses = {
  cyan: { dot: "bg-cyan-300" },
  emerald: { dot: "bg-emerald-300" },
  rose: { dot: "bg-rose-300" },
} as const;

const TeacherClassroomStateShell: React.FC<
  TeacherClassroomStateShellProps
> = ({ children, label, role = "status", tone = "cyan" }) => {
  const toneClass = toneClasses[tone];

  return (
    <main className="flex h-screen-dvh min-h-[34rem] flex-col overflow-hidden bg-slate-950 text-white selection:bg-cyan-300 selection:text-slate-950">
      <header className="flex min-h-16 shrink-0 items-center border-b border-white/10 bg-slate-950/95 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">
            AI Teacher classroom
          </p>
          <p className="hidden text-xs text-slate-400 sm:block">
            Powered by Agora Conversational AI
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-300">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${toneClass.dot}`}
          />
          {label}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 p-3 sm:p-5">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[112rem] gap-2 overflow-hidden lg:gap-3">
          <section
            data-testid="teacher-classroom-board"
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[26px] bg-[#020908] p-1.5 shadow-2xl sm:p-2"
            aria-label="AI Teacher blackboard"
          >
            <div className="absolute inset-1.5 overflow-hidden rounded-[22px] border border-cyan-300/20 bg-[#111516] sm:inset-2">
              <div
                aria-hidden
                className="absolute inset-0 opacity-65 [background-image:linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] [background-position:-1px_-1px] [background-size:80px_80px,80px_80px,20px_20px,20px_20px]"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.045),transparent_62%),linear-gradient(180deg,rgba(2,9,8,0.05),rgba(2,9,8,0.36))]"
              />
            </div>

            <div className="pointer-events-none absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/75 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow-lg backdrop-blur-xl sm:left-6 sm:top-6">
              <MdSchool aria-hidden className="text-base text-cyan-300" />
              AI Teacher
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-5 z-20 hidden -translate-x-1/2 items-center gap-1 rounded-xl border border-white/10 bg-[#23242c]/95 p-1.5 text-slate-300 shadow-xl sm:flex"
            >
              {[MdPanTool, MdGesture, MdCropSquare, MdArrowForward].map(
                (Icon, index) => (
                  <span
                    key={index}
                    className={`grid h-8 w-8 place-items-center rounded-lg ${
                      index === 1 ? "bg-violet-400/25 text-violet-200" : ""
                    }`}
                  >
                    <Icon className="text-base" />
                  </span>
                ),
              )}
            </div>

            <div
              role={role}
              aria-label={label}
              aria-live={role === "alert" ? "assertive" : "polite"}
              className="absolute inset-1.5 z-30 flex items-center justify-center rounded-[22px] bg-slate-950/45 px-5 text-center backdrop-blur-[1px] sm:inset-2"
            >
              {children}
            </div>
          </section>

          <aside
            aria-hidden
            className="hidden h-full w-[clamp(170px,18vw,250px)] shrink-0 items-end lg:flex"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#07110f] shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(103,232,249,0.12),transparent_22%),linear-gradient(145deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))]" />
              <div className="absolute inset-x-[18%] top-[15%] aspect-square rounded-full border border-white/[0.06] bg-white/[0.035]" />
              <div className="absolute inset-x-[10%] bottom-[7%] h-[48%] rounded-t-[45%] border border-white/[0.05] bg-white/[0.025]" />
              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/[0.06] bg-slate-950/70 px-3 py-2 backdrop-blur">
                <div className="h-2 w-16 rounded-full bg-white/10" />
                <div className="mt-2 h-1.5 w-11 rounded-full bg-cyan-300/20" />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <footer
        aria-hidden
        className="flex min-h-20 shrink-0 items-center justify-center border-t border-white/10 bg-slate-950/95 px-2 py-3"
      >
        <div className="flex items-center gap-3 opacity-45">
          <span className="h-11 w-11 rounded-full border border-white/10 bg-white/[0.06]" />
          <span className="h-[3.25rem] w-[3.25rem] rounded-full bg-rose-500/80" />
          <span className="h-11 w-32 rounded-full border border-white/10 bg-white/[0.06]" />
          <span className="h-11 w-11 rounded-full border border-white/10 bg-white/[0.06]" />
        </div>
      </footer>
    </main>
  );
};

export default TeacherClassroomStateShell;
