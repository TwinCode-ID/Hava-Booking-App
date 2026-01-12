import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

const CustomSelect = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Select option",
  getLabel, // New Prop: Function to get the display text
  getValue, // New Prop: Function to get the unique ID value
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Helper to safely get the display label
  const getOptionLabel = (option) => {
    if (getLabel) return getLabel(option);
    return option; // Fallback for simple string arrays
  };

  // Helper to safely get the unique key/value
  const getOptionValue = (option) => {
    if (getValue) return getValue(option);
    return option; // Fallback for simple string arrays
  };

  // Find the selected object to display its label in the input
  const selectedOption = options.find((opt) => getOptionValue(opt) === value);
  const displayValue = selectedOption ? getOptionLabel(selectedOption) : value;

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
    <div className='relative w-full mb-4' ref={containerRef}>
      {label && (
        <label className='block text-xs font-bold text-gray-700 mb-1'>
          {label}
        </label>
      )}
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10.5 px-4 rounded-xl border bg-white flex items-center justify-between transition-all outline-none text-sm font-medium shadow-sm ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span
          className={`block truncate ${
            displayValue ? "text-gray-900" : "text-gray-400"
          }`}>
          {displayValue || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto'>
            {options.map((option) => {
              const optValue = getOptionValue(option);
              const optLabel = getOptionLabel(option);
              const isSelected = value === optValue;

              return (
                <div
                  key={optValue}
                  onClick={() => {
                    onChange(optValue); // Pass back the ID/Value, not the whole object
                    setIsOpen(false);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-bold"
                      : "text-gray-700 hover:bg-gray-50 hover:text-emerald-800"
                  }`}>
                  {optLabel}
                  {isSelected && (
                    <Check className='w-3.5 h-3.5 text-emerald-600' />
                  )}
                </div>
              );
            })}
            {options.length === 0 && (
              <div className='p-4 text-center text-gray-400 text-xs'>
                No options found
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
