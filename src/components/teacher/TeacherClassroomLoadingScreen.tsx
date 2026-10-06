import { MdArrowForward, MdLogout, MdRefresh } from "react-icons/md";
import TeacherClassroomStateShell from "@/components/teacher/TeacherClassroomStateShell";

interface TeacherClassroomLoadingScreenProps {
  errorMessage?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
}

const TeacherClassroomLoadingScreen: React.FC<
  TeacherClassroomLoadingScreenProps
> = ({ errorMessage, onRetry, onSignOut }) => {
  const hasError = Boolean(errorMessage);

  if (hasError) {
    return (
      <TeacherClassroomStateShell
        label="Connection interrupted"
        role="alert"
        tone="rose"
      >
        <div className="max-w-lg">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-rose-300/20 bg-rose-400/10 text-xl font-semibold text-rose-200">
            !
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            We couldn&apos;t prepare your classroom
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
            {errorMessage}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                <MdRefresh aria-hidden />
                Retry
              </button>
            ) : null}
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-slate-950/55 px-5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <MdLogout aria-hidden />
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </TeacherClassroomStateShell>
    );
  }

  return (
    <TeacherClassroomStateShell label="Preparing your classroom">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className="h-11 w-11 animate-spin rounded-full border-[3px] border-cyan-100/15 border-t-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.16)] motion-reduce:animate-none"
        />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
          Preparing your classroom
        </h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-400">
          Connecting your teacher and live blackboard
          <MdArrowForward aria-hidden className="text-cyan-300" />
        </p>
      </div>
    </TeacherClassroomStateShell>
  );
};

export default TeacherClassroomLoadingScreen;
