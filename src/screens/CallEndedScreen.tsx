"use client";

import { useCallback } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const CallEndedScreen: React.FC = () => {
  const router = useRouter();

  const handleStartNewCall = useCallback((): void => {
    router.replace("/call");
  }, [router]);

  const handleSignOut = useCallback((): void => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_45%)]" />
      <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-400/15 text-2xl text-cyan-300">
          ✓
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Call ended
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Thanks for the conversation</h1>
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
};

export default CallEndedScreen;
