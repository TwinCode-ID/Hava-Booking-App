import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CustomSelect = ({
  label,
  value,
  onChange,
  options,
  getLabel,
  getValue,
  placeholder = "Select...",
  searchable = false, // Enable search capability
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm(""); // Reset search on close
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  // Find the selected object based on the ID (value)
  const selectedOption = options.find((opt) => getValue(opt) === value);

  // Filter options based on search term
  const filteredOptions = searchable
    ? options.filter((opt) =>
        getLabel(opt).toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : options;

  const handleSelect = (opt) => {
    onChange(getValue(opt));
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation(); // Prevent opening the menu
    onChange(null); // Send null to parent to clear selection
    setSearchTerm("");
  };

  return (
    <div className='relative w-full' ref={containerRef}>
      {label && (
        <label className='block text-xs font-bold text-gray-700 mb-1'>
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 border rounded-xl flex items-center justify-between cursor-pointer bg-white transition-all ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span
          className={`text-sm truncate pr-2 ${
            selectedOption ? "text-gray-900 font-medium" : "text-gray-400"
          }`}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </span>

        <div className='flex items-center gap-1'>
          {/* Clear Button (Only show if value is selected) */}
          {selectedOption && (
            <button
              onClick={handleClear}
              className='p-1 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors mr-1'>
              <X className='w-4 h-4' />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className='absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden'>
            {/* Search Input (Sticky Top) */}
            {searchable && (
              <div className='p-2 border-b border-gray-100 bg-gray-50'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    ref={searchInputRef}
                    type='text'
                    className='w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    placeholder='Type to search...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking input
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className='max-h-60 overflow-y-auto p-1'>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => {
                  const isSelected = getValue(opt) === value;
                  return (
                    <div
                      key={getValue(opt)}
                      onClick={() => handleSelect(opt)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-emerald-50 text-emerald-700 font-bold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}>
                      <span>{getLabel(opt)}</span>
                      {isSelected && <Check className='w-4 h-4' />}
                    </div>
                  );
                })
              ) : (
                <div className='p-4 text-center text-sm text-gray-400'>
                  No results found.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomSelect;
