'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiBell } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

// Polled rather than realtime: this is a school app where a handful of
// people are signed in at once, and a 60s poll costs one small indexed
// query per user. A Supabase realtime subscription would mean opening a
// websocket on every page in every portal for a notification that is
// almost never urgent.
const POLL_MS = 60_000

export function NotificationBell({ rolePrefix }: { rolePrefix: string }) {
  const router = useRouter()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/me/notifications')
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    if (!data) return
    setItems(data.items ?? [])
    setUnread(data.unread ?? 0)
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  async function markAllRead() {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    await fetch('/api/me/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
  }

  async function openNotification(n: NotificationRow) {
    setOpen(false)

    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1))
      await fetch('/api/me/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id }),
      })
    }

    // Links are stored role-relative ('/grades'), because the same event
    // reaches a student and their parent at different URLs.
    if (n.link) router.push(`${rolePrefix}${n.link}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative p-2 rounded-full text-stone-500 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <FiBell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-terracotta-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 mt-1 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200 dark:border-stone-800">
              <p className="text-sm font-bold text-primary-900 dark:text-white">Notifications</p>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium text-primary-700 dark:text-primary-300 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-sm text-center text-stone-500 dark:text-stone-400">
                  Nothing yet.
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    role="menuitem"
                    onClick={() => openNotification(n)}
                    className={`w-full text-left px-3 py-2.5 border-b border-stone-100 dark:border-stone-800/60 last:border-0 hover:bg-stone-50 dark:hover:bg-stone-800/60 transition-colors ${
                      n.read_at ? '' : 'bg-primary-50/60 dark:bg-primary-950/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
