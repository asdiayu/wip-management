
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label: string;
  id: string;
}

const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(({ options, value, onChange, placeholder, label, id }, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<Option[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose the input element to the parent via ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Set initial input value when a value is already selected or cleared
  useEffect(() => {
    const selectedOption = options.find(option => option.value === value);
    setInputValue(selectedOption ? selectedOption.label : '');
  }, [value, options]);

  // Handle filtering based on input
  useEffect(() => {
      setFilteredOptions(
        options.filter(option =>
          option.label.toLowerCase().includes(inputValue.toLowerCase())
        )
      );
  }, [inputValue, options]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Revert to selected value's label if user clicks away without choosing
        const selectedOption = options.find(option => option.value === value);
        setInputValue(selectedOption ? selectedOption.label : '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, value, options]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setIsOpen(true);
  };

  const handleOptionClick = (option: Option) => {
    onChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
  };
  
  const handleInputFocus = () => {
      setIsOpen(true);
      // Select text on focus for easier replacement
      inputRef.current?.select();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If dropdown is open and there are results, select the first one
      if (filteredOptions.length > 0) {
        handleOptionClick(filteredOptions[0]);
      }
    } else if (e.key === 'ArrowDown') {
      // Future enhancement: Allow arrow key navigation
      if (!isOpen) setIsOpen(true);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="mt-1">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Ketik untuk mencari...'}
          autoComplete="off"
          className="appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors"
        />
      </div>
      {isOpen && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                onClick={() => handleOptionClick(option)}
                className={`px-4 py-2 text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:bg-primary-500 hover:text-white transition-colors ${index === 0 ? 'bg-slate-100 dark:bg-slate-700/50' : ''}`}
              >
                {option.label}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-slate-500">Tidak ada hasil ditemukan</li>
          )}
        </ul>
      )}
    </div>
  );
});

export default SearchableSelect;
