import React, { forwardRef, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  // Add other props as needed, e.g., containerClassName
}

const Select = forwardRef<HTMLSelectElement, SelectProps>((
  { label, id, name, error, children, className, ...props }, 
  ref
) => {
  const inputId = id || name;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">
        <select
          id={inputId}
          name={name}
          ref={ref}
          className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${className || ''}`}
          {...props}
        >
          {children} 
        </select>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
});

Select.displayName = 'Select';

export default Select; 