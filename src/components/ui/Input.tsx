import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  size?: 'default' | 'sm'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, size = 'default', className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const isSm = size === 'sm'
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={`block font-medium text-gray-700 dark:text-gray-300 mb-1 ${isSm ? 'text-xs' : 'text-sm'}`}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-lg border bg-white text-gray-900 shadow-sm
            placeholder:text-gray-400 outline-none transition-all duration-150
            dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500
            ${isSm ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-sm'}
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-500'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:hover:border-gray-500'
            }
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  size?: 'default' | 'sm'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, size = 'default', className = '', id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const isSm = size === 'sm'
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className={`block font-medium text-gray-700 dark:text-gray-300 mb-1 ${isSm ? 'text-xs' : 'text-sm'}`}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full rounded-lg border bg-white text-gray-900 shadow-sm
            outline-none transition-all duration-150
            dark:bg-gray-800 dark:text-gray-100
            ${isSm ? 'px-3 py-1.5 text-sm' : 'px-3.5 py-2.5 text-sm'}
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-500'
              : 'border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:hover:border-gray-500'
            }
            ${className}
          `}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
