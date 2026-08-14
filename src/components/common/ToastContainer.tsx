// src/components/common/ToastContainer.tsx
import React, { useCallback } from "react";
import { createPortal } from "react-dom";
import useAppStore from "@/store/useAppStore";
import Toast from "./Toast";

const ToastContainer: React.FC = () => {
  const toasts = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

  const handleDismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  if (toasts.length === 0) {
    return null;
  }

  return createPortal(
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex flex-col-reverse gap-2 max-w-[calc(100vw-2rem)]"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={handleDismiss}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
