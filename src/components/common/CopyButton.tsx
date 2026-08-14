// src/components/common/CopyButton.tsx
import React, { useState } from "react";
import { MdContentCopy, MdCheck } from "react-icons/md";

interface CopyButtonProps {
  textToCopy: string;
  className?: string;
  size?: number;
}

const CopyButton: React.FC<CopyButtonProps> = ({
  textToCopy,
  className = "",
  size = 20,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          ml-2 px-3 py-1 text-sm rounded-md transition-all duration-200 
          focus:outline-none focus:ring-2 focus:ring-agora
          ${
            copied
              ? "bg-green-500 dark:bg-green-400 hover:bg-green-600 dark:hover:bg-green-500 text-white"
              : "bg-agora hover:opacity-90 text-white"
          }
          ${className}
        `}
        title={copied ? "Copied!" : "Copy to clipboard"}
      >
        {copied ? (
          <MdCheck size={size} className="text-white" />
        ) : (
          <MdContentCopy size={size} className="text-white" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded whitespace-nowrap z-50">
          {copied ? "Text copied to clipboard!" : "Copy to clipboard"}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800 dark:border-t-gray-700"></div>
        </div>
      )}
    </div>
  );
};

export default CopyButton;
