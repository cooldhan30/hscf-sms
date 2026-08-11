'use client'

import { useEffect, useState } from 'react'

// Delays updating the returned value until `value` has stopped changing
// for `delayMs`. Used on search inputs so filtering/re-render only runs
// once per pause in typing rather than on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
