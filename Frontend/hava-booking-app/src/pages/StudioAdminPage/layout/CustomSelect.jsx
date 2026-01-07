import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

const CustomSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select option",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className='relative' ref={containerRef}>
      {/* Label */}
      <label className='block text-sm font-medium text-gray-700 mb-1'>
        {label}
      </label>

      {/* Trigger Button (Looks like an input) */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11.5 p-3 rounded-xl border bg-white flex items-center justify-between transition-all outline-none ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-300"
        }`}>
        <span
          className={`block truncate ${
            value ? "text-gray-900" : "text-gray-400"
          }`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto'>
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`px-4 py-3 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                  value === option
                    ? "bg-emerald-50 text-emerald-900 font-medium"
                    : "text-gray-700 hover:bg-gray-50 hover:text-emerald-800"
                }`}>
                {option}
                {value === option && (
                  <Check className='w-4 h-4 text-emerald-600' />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
