'use client'

import { useState } from 'react'
import { FiChevronDown, FiCheck } from 'react-icons/fi'
import { toast } from '@/lib/toast'
import type { SmsRole } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  parent: 'Parent',
  student: 'Student',
}

// Only rendered when someone holds more than one role -- a teacher who is
// also a parent here, for instance. Switching is a server round-trip
// rather than client state because the acting role IS the role RLS
// enforces against: the next page load must be authorized as the new
// role, so a full navigation is the honest way to change it.
export function RoleSwitcher({ current, available }: { current: SmsRole; available: SmsRole[] }) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  if (available.length < 2) return null

  async function switchTo(role: SmsRole) {
    setOpen(false)
    if (role === current) return

    setSwitching(true)
    const res = await fetch('/api/me/active-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setSwitching(false)
      toast.error(data.error || 'Could not switch profile')
      return
    }

    // Hard navigation, not router.push: middleware re-reads the acting
    // role on the way in and every server component below re-renders
    // against the new one.
    window.location.href = `/tamizhi${data.redirectTo}`
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
      >
        {switching ? 'Switching...' : ROLE_LABELS[current] ?? current}
        <FiChevronDown className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          {/* Click-away layer, so the menu closes on any outside click. */}
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 mt-1 z-30 min-w-[10rem] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-lg py-1"
          >
            <p className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500">
              Switch profile
            </p>
            {available.map((role) => (
              <button
                key={role}
                role="menuitem"
                onClick={() => switchTo(role)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                {ROLE_LABELS[role] ?? role}
                {role === current && <FiCheck className="w-4 h-4 text-primary-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
