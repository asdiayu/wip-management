
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightElement?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, id, rightElement, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="mt-1 relative">
        <input
          id={id}
          className={`appearance-none block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-colors ${rightElement ? 'pr-10' : ''}`}
          {...props}
        />
        {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {rightElement}
            </div>
        )}
      </div>
    </div>
  );
};

export default Input;
