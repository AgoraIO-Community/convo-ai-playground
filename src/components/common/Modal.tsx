// src/components/common/Modal.tsx
import React, { useEffect, useRef } from "react";
import { MdClose } from "react-icons/md";

interface ModalProps {
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Function to call when modal is requested to close
  title: string; // Title displayed in the modal header
  children: React.ReactNode; // Content to display inside the modal body
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Effect to handle closing modal on Escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose(); // Call onClose if Escape is pressed
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    // Cleanup: remove event listener when modal closes or component unmounts
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]); // Dependencies: re-run if isOpen or onClose changes

  // Effect to handle closing modal when clicking outside its content
  const handleClickOutside = (event: MouseEvent) => {
    // If modal is open and click is outside the modal content area
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose(); // Call onClose
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    // Cleanup: remove event listener
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]); // Dependencies: re-run if isOpen or onClose changes

  // If modal is not open, render nothing
  if (!isOpen) return null;

  return (
    // Overlay: Fixed position, covers entire screen, semi-transparent background.
    // bg-black bg-opacity-70 dark:bg-opacity-80 ensures theme-aware dimming.
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 dark:bg-opacity-80 transition-opacity duration-300">
      {/* Modal Content Area: Centered, responsive width, theme-aware colors for background, border, text. */}
      {/* Uses ref for click-outside detection. */}
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-lg p-6 relative transform transition-transform duration-300 scale-100 opacity-100"
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-300 dark:border-gray-600 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          {/* Close Button */}
          <button
            onClick={onClose} // Calls the onClose prop
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200"
            aria-label="Close modal"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Modal Body: Renders children passed to the Modal component. Theme-aware text. */}
        <div className="text-gray-700 dark:text-gray-300 text-base sm:text-lg">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
