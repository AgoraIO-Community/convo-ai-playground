"use client";

import { useCallback } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { MdArrowForward, MdCheck, MdLogout } from "react-icons/md";
import TeacherClassroomStateShell from "@/components/teacher/TeacherClassroomStateShell";
import { isAiTeacherModeEnabled } from "@/constants/featureFlags";

const CallEndedScreen: React.FC = () => {
  const router = useRouter();
  const teacherModeEnabled = isAiTeacherModeEnabled();

  const handleStartNewCall = useCallback((): void => {
    router.replace(teacherModeEnabled ? "/classroom" : "/call");
  }, [router, teacherModeEnabled]);

  const handleSignOut = useCallback((): void => {
    void signOut({ callbackUrl: "/" });
  }, []);

  if (!teacherModeEnabled) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_45%)]" />
        <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/15 text-2xl text-cyan-300">
            <MdCheck aria-hidden />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
            Call ended
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Thanks for the conversation
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Start another private session or sign out when you are finished.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleStartNewCall}
              className="rounded-full bg-cyan-400 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Start new call
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-white/20 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <TeacherClassroomStateShell label="Lesson complete" tone="emerald">
      <div className="max-w-lg">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-xl text-emerald-200">
          <MdCheck aria-hidden />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          Lesson complete
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
          Your classroom is ready whenever you want to explore another idea.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={handleStartNewCall}
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Start another lesson
            <MdArrowForward
              aria-hidden
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 bg-slate-950/55 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            <MdLogout aria-hidden />
            Sign out
          </button>
        </div>
      </div>
    </TeacherClassroomStateShell>
  );
};

export default CallEndedScreen;
