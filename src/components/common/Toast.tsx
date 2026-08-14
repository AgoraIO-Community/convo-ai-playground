// src/components/common/Toast.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  MdCheckCircle,
  MdError,
  MdWarning,
  MdInfo,
  MdClose,
} from "react-icons/md";
import type { ToastType } from "@/store/useAppStore";

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onDismiss: (id: string) => void;
}

const typeConfig: Record<
  ToastType,
  {
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    accentClass: string;
  }
> = {
  success: {
    icon: MdCheckCircle,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    accentClass: "bg-emerald-600 dark:bg-emerald-400",
  },
  error: {
    icon: MdError,
    iconClass: "text-red-500 dark:text-red-400",
    accentClass: "bg-red-500 dark:bg-red-400",
  },
  warning: {
    icon: MdWarning,
    iconClass: "text-amber-500 dark:text-amber-400",
    accentClass: "bg-amber-500 dark:bg-amber-400",
  },
  info: {
    icon: MdInfo,
    iconClass: "text-blue-500 dark:text-blue-400",
    accentClass: "bg-blue-500 dark:bg-blue-400",
  },
};

const Toast: React.FC<ToastProps> = ({ id, message, type, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const config = typeConfig[type];
  const Icon = config.icon;

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(id);
    }, 250);
  }, [id, onDismiss]);

  // Trigger enter animation on mount
  useEffect(() => {
    const enterTimer = requestAnimationFrame(() => {
      setIsVisible(true);
    });
    return () => cancelAnimationFrame(enterTimer);
  }, []);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 4000);

    return () => clearTimeout(timer);
  }, [handleDismiss]);

  return (
    <div
      role="alert"
      onClick={handleDismiss}
      className={`
        relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer
        min-w-[300px] max-w-[400px] overflow-hidden
        bg-white/90 dark:bg-gray-800/90 backdrop-blur-md
        border border-gray-200/60 dark:border-gray-700/60
        shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)]
        transition-all duration-250 ease-out
        ${isVisible && !isExiting ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}
      `}
    >
      {/* Left accent bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${config.accentClass}`}
      />

      <Icon className={`text-xl flex-shrink-0 ${config.iconClass}`} />
      <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug">
        {message}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
        className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors duration-150"
        aria-label="Dismiss notification"
      >
        <MdClose className="text-base" />
      </button>
    </div>
  );
};

export default Toast;
