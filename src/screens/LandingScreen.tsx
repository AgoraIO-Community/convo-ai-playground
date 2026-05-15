"use client";

import React, { useCallback } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

const AGORA_CONVO_AI_URL =
  "https://www.agora.io/en/products/conversational-ai-engine/";
const AGORA_CONVO_AI_RELEASE_NOTES_URL =
  "https://docs.agora.io/en/conversational-ai/overview/release-notes#v26";

const LandingScreen: React.FC = () => {
  const handleSignInWithGoogle = useCallback(() => {
    void signIn("google", { callbackUrl: "/" });
  }, []);

  return (
    <div className="min-h-screen-dvh flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Background: gradient mesh + subtle grain (slow float for depth) */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(0,194,255,0.12),transparent_50%)] animate-landing-bg-float origin-center" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_80%,rgba(0,194,255,0.08),transparent_45%)] animate-landing-bg-float-secondary origin-center" />
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Content */}
      <main className="relative flex flex-col flex-1 items-center justify-between px-4 sm:px-6 pt-12 sm:pt-16 pb-8 sm:pb-12">
        {/* Top spacer */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center">
          {/* Staggered reveal */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-4 sm:mb-6 animate-fade-in-up font-syne"
            style={{
              animationDelay: "0.1s",
              animationFillMode: "backwards",
            }}
          >
            Experience
            <br />
            <span className="bg-[linear-gradient(to_right,var(--agora-accent-blue),#33d1ff)] bg-clip-text text-transparent animate-landing-gradient-shimmer inline-block">
              Conversational AI
            </span>
          </h1>
          <p
            className="text-gray-400 text-base sm:text-lg max-w-md mx-auto mb-8 sm:mb-10 animate-fade-in-up"
            style={{
              animationDelay: "0.3s",
              animationFillMode: "backwards",
            }}
          >
            Real-time voice / video calling agents that understand and respond
            naturally—powered by Agora.
          </p>
          <Link
            href={AGORA_CONVO_AI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium transition-colors duration-200 underline underline-offset-4 animate-fade-in-up [color:var(--agora-accent-blue)] hover:opacity-90 decoration-[var(--agora-accent-blue)]"
            style={{
              animationDelay: "0.5s",
              animationFillMode: "backwards",
            }}
          >
            Learn more about Agora Conversational AI
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Link>

          <Link
            href={AGORA_CONVO_AI_RELEASE_NOTES_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="View Agora Conversational AI v2.6 release notes"
            className="group mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs sm:text-[13px] text-gray-300 hover:text-white hover:border-[var(--agora-accent-blue)]/40 hover:bg-[var(--agora-accent-blue)]/10 transition-all duration-200 animate-fade-in-up"
            style={{
              animationDelay: "0.6s",
              animationFillMode: "backwards",
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--agora-accent-blue)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--agora-accent-blue)]" />
            </span>
            <span>
              Powered by Agora Conversational AI{" "}
              <span className="font-semibold text-white">v2.6</span>
            </span>
            <svg
              className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </Link>
        </div>

        {/* Bottom center: Sign in with Google */}
        <div
          className="flex flex-col items-center gap-4 animate-fade-in-up"
          style={{
            animationDelay: "0.7s",
            animationFillMode: "backwards",
          }}
        >
          <div className="relative rounded-xl animate-landing-button-glow">
            <button
              type="button"
              onClick={handleSignInWithGoogle}
              className="group relative flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white dark:bg-gray-100 text-gray-900 font-semibold shadow-lg shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:scale-[1.02] hover:bg-gray-50 dark:hover:bg-white transition-all duration-300 border border-gray-200/50 dark:border-gray-300/50 cursor-pointer overflow-hidden active:scale-[0.98]"
            >
            <svg
              className="w-5 h-5 relative z-10"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="relative z-10">Sign in with Google</span>
            </button>
          </div>
          <p className="text-gray-500 text-xs sm:text-sm text-center max-w-xs">
            Sign in with Google to create or join meetings.
          </p>
        </div>
      </main>
    </div>
  );
};

export default LandingScreen;
