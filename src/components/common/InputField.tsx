// src/components/common/InputField.tsx
import React from "react";

interface InputFieldProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  className?: string;
  wrapperClassName?: string;
  focusRingColorClass?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  className,
  wrapperClassName,
  // UPDATED: Default focus ring color using direct Tailwind classes
  focusRingColorClass = "focus:ring-agora",
}) => {
  return (
    <div className={`mb-4 sm:mb-6 ${wrapperClassName || ""}`}>
      <label
        htmlFor={id}
        // UPDATED: Using direct Tailwind default colors for label text
        className="block text-gray-700 dark:text-gray-300 text-base sm:text-lg font-medium mb-2"
      >
        {label}
      </label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        // UPDATED: Using direct Tailwind default colors for input
        className={`
          w-full p-3 sm:p-4 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600
          text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2
          ${focusRingColorClass} text-base sm:text-lg transition-all
          ${className || ""}
        `}
      />
    </div>
  );
};

export default InputField;
