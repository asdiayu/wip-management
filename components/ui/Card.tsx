import React from 'react';

interface CardProps {
  title: string;
  value: string | number;
  unit?: string;
  // FIX: (Line 16) Specify that the icon prop is a ReactElement that accepts an optional className.
  // This resolves the TypeScript error with React.cloneElement.
  icon: React.ReactElement<{ className?: string }>;
  color?: string;
}

const Card: React.FC<CardProps> = ({ title, value, unit, icon, color = 'bg-primary-500' }) => {
  return (
    <div className="bg-white dark:bg-slate-800/50 shadow-md rounded-xl p-6 flex items-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className={`p-4 rounded-full text-white ${color}`}>
        {React.cloneElement(icon, { className: 'h-8 w-8' })}
      </div>
      <div className="ml-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-white">
          {value} <span className="text-xl font-medium">{unit}</span>
        </p>
      </div>
    </div>
  );
};

export default Card;
