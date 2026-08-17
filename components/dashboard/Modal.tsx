'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef } from 'react'
import { FiX } from 'react-icons/fi'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const MAX_WIDTH = {
  default: 'max-w-lg',
  large: 'max-w-4xl',
} as const

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'default',
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  size?: 'default' | 'large'
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  // Focus moves into the dialog once, on open, and returns to whatever
  // triggered it on close. Deliberately depends on `open` ONLY -- every
  // caller passes an inline `onClose={() => ...}`, a fresh function
  // identity on every parent re-render (e.g. every keystroke in a form
  // inside the modal). If this effect depended on `onClose` too, it
  // would re-run on every keystroke and re-steal focus to the dialog's
  // first focusable element -- the header's Close button, which sits
  // before the form fields in the DOM -- yanking focus out of whatever
  // input the user was typing in. This bug existed and affected every
  // modal-based form in the app.
  useEffect(() => {
    if (!open) return

    triggerRef.current = document.activeElement
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    focusable?.[0]?.focus()

    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [open])

  // Escape closes; Tab is trapped inside the dialog while open. Separate
  // effect so its `onClose` dependency doesn't touch focus -- re-adding
  // the listener on every keystroke is harmless, unlike re-stealing focus.
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
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
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`w-full ${MAX_WIDTH[size]} max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-800`}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800">
              <h2 id={titleId} className="text-lg font-bold text-primary-900 dark:text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
