"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MdChat } from "react-icons/md";

interface TranscriptDrawerProps {
  isOpen: boolean;
  onOpen(): void;
  onClose(): void;
  children: ReactNode;
}

const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  children,
}) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (!isOpen) {
      if (wasOpen) triggerRef.current?.focus();
      return;
    }

    panelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onOpen}
        aria-label="Open transcript and chat"
        aria-controls="live-transcript-drawer"
        aria-expanded={isOpen}
        className={`absolute left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-2 rounded-r-full border border-l-0 border-cyan-200/20 bg-slate-950/90 px-3 py-2.5 text-xs font-semibold text-cyan-50 shadow-xl backdrop-blur transition duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-inset motion-reduce:transition-none ${
          isOpen
            ? "pointer-events-none -translate-x-full opacity-0"
            : "translate-x-0 opacity-100 hover:bg-slate-900"
        }`}
      >
        <MdChat aria-hidden className="text-base text-cyan-300" />
        <span className="hidden sm:inline">Transcript</span>
      </button>

      <div className="pointer-events-none absolute inset-0 z-40">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close transcript drawer"
          onClick={onClose}
          className={`absolute inset-0 bg-slate-950/60 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${
            isOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          id="live-transcript-drawer"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Live transcript and chat"
          aria-hidden={!isOpen}
          tabIndex={-1}
          inert={!isOpen}
          className={`pointer-events-auto absolute inset-y-0 left-0 w-[min(92vw,390px)] border-r border-white/10 bg-slate-900 shadow-[24px_0_80px_rgba(0,0,0,0.5)] transition-transform duration-300 focus:outline-none motion-reduce:transition-none ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {children}
        </aside>
      </div>
    </>
  );
};

export default TranscriptDrawer;
