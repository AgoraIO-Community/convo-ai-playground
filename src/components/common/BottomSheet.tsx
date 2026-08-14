"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MdClose } from "react-icons/md";

type SnapPoint = number;

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Heights as fraction of viewport (0..1). First value is initial snap. Default: [0.55, 0.92]. */
  snapPoints?: SnapPoint[];
  /** Show the drag handle pill at the top. Default: true. */
  showHandle?: boolean;
  /** Show the close (X) button next to the title. Default: true when title is set. */
  showCloseButton?: boolean;
  /** Extra className for the content scroll area. */
  contentClassName?: string;
  /** Extra className for the sheet body wrapper (after handle/header). */
  bodyClassName?: string;
  /** ID used for aria-labelledby. */
  ariaLabelledBy?: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = [0.55, 0.92],
  showHandle = true,
  showCloseButton,
  contentClassName = "",
  bodyClassName = "",
  ariaLabelledBy,
}) => {
  const [snapIndex, setSnapIndex] = useState(0);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const dragStartY = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const showClose = showCloseButton ?? !!title;

  // Reset snap to first on open
  useEffect(() => {
    if (isOpen) {
      setSnapIndex(0);
      setDragOffsetPx(0);
    }
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.clientY - dragStartY.current;
    setDragOffsetPx(Math.max(-200, dy));
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragStartY.current == null) return;
      const dy = e.clientY - dragStartY.current;
      dragStartY.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDragOffsetPx(0);

      // Threshold logic
      const DISMISS_PX = 120;
      const SNAP_PX = 60;
      if (dy > DISMISS_PX && snapIndex === 0) {
        onClose();
        return;
      }
      if (dy > SNAP_PX && snapIndex > 0) {
        setSnapIndex((idx) => Math.max(0, idx - 1));
        return;
      }
      if (dy < -SNAP_PX && snapIndex < snapPoints.length - 1) {
        setSnapIndex((idx) => Math.min(snapPoints.length - 1, idx + 1));
        return;
      }
    },
    [snapIndex, snapPoints.length, onClose],
  );

  if (!isOpen) return null;

  const heightFraction = snapPoints[snapIndex] ?? 0.55;
  const sheetHeight = `${heightFraction * 100}%`;

  return (
    <div
      className="fixed inset-0 z-[60] sheet-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={sheetRef}
        className={`absolute left-0 right-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col will-change-transform transition-[height,transform] duration-300 ease-out ${bodyClassName}`}
        style={{
          height: sheetHeight,
          transform: `translateY(${dragOffsetPx}px)`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {showHandle && (
            <div className="flex justify-center pt-2 pb-1">
              <span className="block w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
          )}
          {title && (
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-gray-200 dark:border-gray-700">
              <h3
                id={ariaLabelledBy}
                className="text-base font-semibold text-gray-900 dark:text-white truncate"
              >
                {title}
              </h3>
              {showClose && (
                <button
                  onClick={onClose}
                  className="p-1.5 -mr-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  aria-label="Close"
                >
                  <MdClose size={22} />
                </button>
              )}
            </div>
          )}
        </div>
        <div
          className={`flex-1 overflow-y-auto overscroll-contain ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
