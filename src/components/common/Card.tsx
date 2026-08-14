// src/components/common/Card.tsx
import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    // UPDATED: Using direct Tailwind default colors for card background/shadow
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl p-6 sm:p-8 shadow-xl dark:shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg transition-colors duration-300 ${
        className || ""
      }`}
    >
      {children}
    </div>
  );
};

export default Card;
