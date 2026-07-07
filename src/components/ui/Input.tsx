import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label, error, hint, className, id, ...props
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded bg-white dark:bg-gray-800 dark:text-white',
          'text-gray-900 placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'transition-colors',
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-300 dark:border-gray-600',
          'disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-900',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
});

Input.displayName = 'Input';
