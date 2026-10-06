import {
  MdArrowForward,
  MdAutoAwesome,
  MdGraphicEq,
  MdLogout,
  MdSchool,
} from "react-icons/md";

interface TeacherClassroomLoadingScreenProps {
  errorMessage?: string;
  onRetry?: () => void;
  onSignOut?: () => void;
}

const preparationSteps = [
  { label: "Private session", icon: MdGraphicEq },
  { label: "AI teacher", icon: MdSchool },
  { label: "Live blackboard", icon: MdAutoAwesome },
] as const;

const TeacherClassroomLoadingScreen: React.FC<
  TeacherClassroomLoadingScreenProps
> = ({ errorMessage, onRetry, onSignOut }) => {
  const hasError = Boolean(errorMessage);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#02050c] px-5 py-10 text-white selection:bg-cyan-300 selection:text-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(34,211,238,0.13),transparent_30%),radial-gradient(circle_at_78%_76%,rgba(79,70,229,0.16),transparent_34%),linear-gradient(135deg,#02050c_0%,#040817_50%,#02050c_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]"
      />

      <section className="relative w-full max-w-3xl overflow-hidden rounded-[32px] border border-cyan-200/15 bg-slate-950/70 px-6 py-9 text-center shadow-[0_32px_120px_rgba(8,145,178,0.18)] backdrop-blur-xl sm:px-10 sm:py-12">
        <div
          aria-hidden
          className="absolute inset-x-14 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent"
        />

        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-200/15 bg-cyan-300/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-cyan-200">
          <MdSchool aria-hidden className="text-base" />
          AI Teacher classroom
        </div>

        {hasError ? (
          <>
            <div className="mx-auto mt-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-400/10 text-2xl text-rose-200">
              !
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">
              Classroom setup interrupted
            </p>
            <h1 className="mt-3 font-[Georgia,ui-serif,serif] text-3xl tracking-[-0.03em] text-slate-50 sm:text-5xl">
              We couldn&apos;t prepare your class
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              {errorMessage}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-4 focus:ring-offset-[#02050c] motion-reduce:transform-none"
                >
                  Try again
                  <MdArrowForward
                    aria-hidden
                    className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                  />
                </button>
              ) : null}
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <MdLogout aria-hidden />
                  Sign out
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto mt-8 h-20 w-20">
              <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/25 motion-reduce:animate-none" />
              <span className="absolute inset-2 rounded-full border border-cyan-200/20 bg-cyan-300/[0.07]" />
              <span className="absolute inset-[26px] animate-pulse rounded-full bg-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.8)] motion-reduce:animate-none" />
            </div>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Connecting securely
            </p>
            <h1 className="mt-3 font-[Georgia,ui-serif,serif] text-4xl tracking-[-0.04em] text-slate-50 sm:text-6xl">
              Preparing your classroom
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
              We&apos;re opening your live blackboard and bringing your AI teacher
              into the lesson.
            </p>

            <div className="mx-auto mt-9 grid max-w-2xl gap-3 sm:grid-cols-3">
              {preparationSteps.map(({ label, icon: Icon }, index) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-left"
                >
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.08] text-cyan-200">
                    <Icon aria-hidden className="text-lg" />
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-cyan-300 motion-reduce:animate-none"
                      style={{ animationDelay: `${index * 240}ms` }}
                    />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs text-slate-600">
              This usually takes only a few seconds.
            </p>
          </>
        )}
      </section>
    </main>
  );
};

export default TeacherClassroomLoadingScreen;
