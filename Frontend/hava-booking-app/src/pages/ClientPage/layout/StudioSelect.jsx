import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

const StudioSelect = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select option",
  getLabel, // Function to get the display text from an object
  getValue, // Function to get the unique ID from an object
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

  // --- HELPER: Resolve Display Text ---
  // If options are objects, find the one matching the current 'value' (ID) and show its label
  const selectedOption = options.find((opt) => {
    const optVal = getValue ? getValue(opt) : opt;
    return optVal === value;
  });

  const displayValue = selectedOption
    ? getLabel
      ? getLabel(selectedOption)
      : selectedOption
    : value || placeholder;

  return (
    <div className='relative' ref={containerRef}>
      {label && (
        <label className='block text-sm font-medium text-gray-700 mb-1'>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 rounded-xl border bg-white flex items-center justify-between transition-all outline-none ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-300"
        }`}>
        <span
          className={`block truncate ${
            selectedOption || value ? "text-gray-900" : "text-gray-400"
          }`}>
          {displayValue}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Options */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto'>
            {options.map((option, index) => {
              // Determine Label and Value for this specific option
              const labelStr = getLabel ? getLabel(option) : option;
              const valStr = getValue ? getValue(option) : option;
              const isSelected = value === valStr;

              return (
                <div
                  key={index}
                  onClick={() => {
                    onChange(valStr); // Return the ID (value) not the whole object
                    setIsOpen(false);
                  }}
                  className={`px-4 py-3 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-medium"
                      : "text-gray-700 hover:bg-gray-50 hover:text-emerald-800"
                  }`}>
                  {labelStr}
                  {isSelected && <Check className='w-4 h-4 text-emerald-600' />}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioSelect;
