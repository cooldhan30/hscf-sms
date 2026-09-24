'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef } from 'react'
import { FiX } from 'react-icons/fi'
import { useGameV2Motion } from './useGameV2Motion'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// A GameRoom V2-styled dialog. Deliberately its own component rather
// than a themed wrapper around components/dashboard/Modal.tsx --
// reusing that component here would pull a portal wired to the main
// app's design tokens into the V2 tree; this reimplements the same
// proven focus-trap/escape-key behavior (copied from Modal.tsx's own
// logic, which already fixed a real focus-stealing bug -- see that
// file's comments) rather than inventing new accessibility logic from
// scratch.
const MAX_WIDTH = {
  default: 'max-w-lg',
  large: 'max-w-2xl',
} as const

export function GameV2Modal({
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
  const { reduced } = useGameV2Motion()

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-gamev2ink-950/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduced ? { duration: 0 } : undefined}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`w-full ${MAX_WIDTH[size]} max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-gamev2ink-900 shadow-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 20 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gamev2ink-100 dark:border-gamev2ink-800">
              <h2 id={titleId} className="text-lg font-extrabold text-gamev2ink-900 dark:text-white">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-gamev2ink-400 hover:text-gamev2ink-700 dark:hover:text-white hover:bg-gamev2ink-100 dark:hover:bg-gamev2ink-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400"
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
