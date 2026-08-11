'use client'

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAlertTriangle } from 'react-icons/fi'
import { Button } from './Button'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// App-wide replacement for window.confirm(): await confirm({...}) from any
// client component instead of each screen owning its own modal state.
// Renders a single accessible alertdialog (Escape/focus-trap/labelled,
// same pattern as Modal.tsx) mounted once at the root.
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const titleId = useId()
  const descId = useId()

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  function settle(result: boolean) {
    resolveRef.current?.(result)
    resolveRef.current = null
    setOptions(null)
  }

  useEffect(() => {
    if (!options) return

    triggerRef.current = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[focusable.length - 1]?.focus() // focus the primary (confirm) action by default

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        settle(false)
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {options && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => settle(false)}
          >
            <motion.div
              ref={dialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={options.description ? descId : undefined}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-800 p-6"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3 mb-4">
                {options.tone === 'danger' && (
                  <span className="flex-shrink-0 p-2 rounded-full bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-600 dark:text-terracotta-400">
                    <FiAlertTriangle className="w-5 h-5" />
                  </span>
                )}
                <div>
                  <h2 id={titleId} className="text-lg font-bold text-primary-900 dark:text-white">
                    {options.title}
                  </h2>
                  {options.description && (
                    <p id={descId} className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                      {options.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => settle(false)}>
                  {options.cancelLabel ?? 'Cancel'}
                </Button>
                <Button variant={options.tone === 'danger' ? 'secondary' : 'primary'} size="sm" onClick={() => settle(true)}>
                  {options.confirmLabel ?? 'Confirm'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  return ctx
}
