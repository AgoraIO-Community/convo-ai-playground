// src/components/common/ThemeSwitcher.tsx
import React from "react";
import useAppStore from "@/store/useAppStore";
import { MdWbSunny, MdDarkMode } from "react-icons/md"; // Import Sun and Moon icons

const ThemeSwitcher: React.FC = () => {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);

  // Determine if the checkbox should be 'checked' (reflecting dark mode)
  const isDark = theme === "dark";

  return (
    // The <label> element makes the entire visual toggle clickable for accessibility
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={isDark}
        onChange={toggleTheme}
        className="sr-only"
      />

      <div
        className="
        w-14 h-8 
        bg-gray-300 dark:bg-gray-700
        rounded-full 
        focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800
        relative transition-colors duration-300
      "
      >
        {/* Sun Icon */}
        {!isDark && (
          <MdWbSunny
            className="
            absolute left-2 top-1/2 -translate-y-1/2
            text-yellow-500 text-xl
            transition-opacity duration-300
            z-10
          "
          />
        )}

        {/* Moon Icon */}
        {isDark && (
          <MdDarkMode
            className="
            absolute right-2 top-1/2 -translate-y-1/2
            text-gray-600 text-xl
            transition-opacity duration-300
            z-10
          "
          />
        )}

        {/* Thumb */}
        <span
          className={`
          absolute top-1/2 left-1 
          w-7 h-7
          bg-white dark:bg-gray-300
          rounded-full shadow-lg
          -translate-y-1/2
          transition-transform duration-300
          ${isDark ? "translate-x-5" : ""}
          z-0
        `}
        ></span>
      </div>
    </label>
  );
};

export default ThemeSwitcher;
