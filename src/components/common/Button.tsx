// src/components/common/Button.tsx
import React from "react";
import type { IconType } from "react-icons";

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  type?: "button" | "submit" | "reset";
  variant?: ButtonVariant;
  Icon?: IconType;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  type = "button",
  variant = "primary",
  Icon,
  className,
}) => {
  // UPDATED: Using direct Tailwind default colors for variants
  const variantClasses = {
    primary:
      "bg-agora-accent-blue hover:opacity-70 border-agora-accent-blue border-solid",
    secondary:
      "bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 border-green-600 dark:border-green-500 hover:border-green-700 dark:hover:border-green-600",
    danger:
      "bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 border-red-600 dark:border-red-500 hover:border-red-700 dark:hover:border-red-600",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        cursor-pointer
        w-full text-white font-bold py-3 sm:py-4 px-6 rounded-lg
        text-lg sm:text-xl transition-all duration-200 ease-in-out shadow-lg
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center space-x-2
        border border-solid
        ${variantClasses[variant]}
        ${className || ""}
      `}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-6 w-6 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : (
        <>
          {Icon && <Icon className="text-xl sm:text-2xl" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

export default Button;
