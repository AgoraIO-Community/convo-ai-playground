// src/services/uiService.ts
import useAppStore from "@/store/useAppStore";
import type { ToastType } from "@/store/useAppStore";

/**
 * Displays a toast notification with a specified message and type.
 *
 * @param {string} message - The message to display in the toast.
 * @param {ToastType} [type="success"] - The type of toast (success, error, warning, info).
 */
export const showToast = (
  message: string,
  type: ToastType = "success"
): void => {
  useAppStore.getState().addToast(message, type);
};
