import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Phone, Search } from "lucide-react";
import { COUNTRY_CODES, toNationalDigits } from "../utils/countryCodes";

// A country picker paired with the national number. The parent owns both halves
// so it can submit them as one E.164 string.
const PhoneNumberInput = ({
  country,
  onCountryChange,
  value,
  onChange,
  error,
  disabled = false,
  autoFocus = false,
  inputId = "phone-number",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const countries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return COUNTRY_CODES;
    return COUNTRY_CODES.filter(
      (option) =>
        option.name.toLowerCase().includes(query) ||
        option.iso.toLowerCase().includes(query) ||
        option.dialCode.includes(query.replace(/^\+?/, "+")) ||
        option.dialCode.includes(query),
    );
  }, [search]);

  const selectCountry = (option) => {
    onCountryChange(option);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className='relative'>
      <div
        className={`flex rounded-xl border ${
          error ? "border-red-500" : "border-stone-200"
        } focus-within:ring-2 focus-within:ring-stone-500 transition-all`}>
        <button
          type='button'
          onClick={() => setIsOpen((open) => !open)}
          disabled={disabled}
          aria-haspopup='listbox'
          aria-expanded={isOpen}
          aria-label={`Country code, currently ${country.name} ${country.dialCode}`}
          className='flex items-center gap-1.5 pl-3 pr-2.5 py-3.5 rounded-l-xl text-stone-800 font-medium hover:bg-stone-50 transition-colors disabled:opacity-50 shrink-0'>
          <span className='text-lg leading-none'>{country.flag}</span>
          <span className='text-sm'>{country.dialCode}</span>
          <ChevronDown
            className={`w-4 h-4 text-stone-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div className='w-px my-2.5 bg-stone-200' />

        <div className='relative flex-1'>
          <Phone className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5 pointer-events-none' />
          <input
            id={inputId}
            type='tel'
            name='phoneNumber'
            autoComplete='tel-national'
            inputMode='numeric'
            value={value}
            disabled={disabled}
            autoFocus={autoFocus}
            onChange={(event) => onChange(toNationalDigits(event.target.value))}
            className='w-full bg-transparent pl-10 pr-3 py-3.5 rounded-r-xl outline-none'
            placeholder='81234567890'
          />
        </div>
      </div>

      {isOpen && (
        <div className='absolute z-30 mt-2 w-full rounded-xl border border-stone-200 bg-white shadow-xl shadow-stone-600/10 overflow-hidden'>
          <div className='relative border-b border-stone-100'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4' />
            <input
              ref={searchRef}
              type='text'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='w-full pl-9 pr-3 py-2.5 text-sm outline-none'
              placeholder='Search country or code'
            />
          </div>

          <ul role='listbox' className='max-h-60 overflow-y-auto py-1'>
            {countries.map((option) => (
              <li key={`${option.iso}-${option.dialCode}`}>
                <button
                  type='button'
                  role='option'
                  aria-selected={option.iso === country.iso}
                  onClick={() => selectCountry(option)}
                  className='w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-stone-50 transition-colors'>
                  <span className='text-base leading-none'>{option.flag}</span>
                  <span className='flex-1 text-stone-800 truncate'>
                    {option.name}
                  </span>
                  <span className='text-stone-500'>{option.dialCode}</span>
                  {option.iso === country.iso && (
                    <Check className='w-4 h-4 text-stone-800' />
                  )}
                </button>
              </li>
            ))}
            {countries.length === 0 && (
              <li className='px-3 py-3 text-sm text-stone-500'>
                No matching country
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PhoneNumberInput;
