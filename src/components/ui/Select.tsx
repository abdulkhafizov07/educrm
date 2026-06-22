import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label, error, options, placeholder, className, id, ...props
}, ref) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          'w-full px-3 py-2 text-sm border rounded bg-white dark:bg-gray-800 dark:text-white',
          'text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
          'transition-colors disabled:opacity-50',
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
