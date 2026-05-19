import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400
            ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'}
            ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', id, children, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-all duration-200
            ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100' : 'border-slate-200 hover:border-indigo-300 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'}
            ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
