'use client'

import { useId } from 'react'

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'tel' | 'date' | 'number'
  placeholder?: string
  required?: boolean
  error?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        {label}
        {required && <span className="text-terracotta-600 dark:text-terracotta-400"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:border-transparent ${
          error
            ? 'border-terracotta-400 dark:border-terracotta-700 focus:ring-terracotta-500'
            : 'border-stone-300 dark:border-stone-700 focus:ring-primary-600'
        }`}
      />
      {error && (
        <p id={errorId} className="text-xs text-terracotta-600 dark:text-terracotta-400 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  required = false,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  required?: boolean
  error?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        {label}
        {required && <span className="text-terracotta-600 dark:text-terracotta-400"> *</span>}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:border-transparent ${
          error
            ? 'border-terracotta-400 dark:border-terracotta-700 focus:ring-terracotta-500'
            : 'border-stone-300 dark:border-stone-700 focus:ring-primary-600'
        }`}
      />
      {error && (
        <p id={errorId} className="text-xs text-terracotta-600 dark:text-terracotta-400 mt-1">
          {error}
        </p>
      )}
    </div>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
