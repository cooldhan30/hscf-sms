'use client'

import { Toaster } from 'sonner'
import { useTheme } from '@/components/ThemeProvider'

// Single <Toaster/> mounted once at the root, themed to match the app's
// light/dark toggle and HSCF palette. Pages call the `toast` export from
// `lib/toast.ts` -- they never need to know a <Toaster/> exists.
export function ToastProvider() {
  const { theme } = useTheme()

  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl border font-sans',
        },
      }}
    />
  )
}
