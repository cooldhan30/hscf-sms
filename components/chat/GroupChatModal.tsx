'use client'

import { useEffect, useState } from 'react'
import { FiUsers } from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { getChatContacts } from '@/lib/chat'
import type { SmsChatContact } from '@/types/database'

// Same contact pool as the 1:1 ContactPicker (sms_chat_contacts()) --
// group membership is gated by the exact same relationship rules, just
// applied per invited member (see 028_group_chat.sql).
export function GroupChatModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (name: string, memberIds: string[]) => Promise<void>
}) {
  const supabase = useSupabaseBrowserClient()
  const [contacts, setContacts] = useState<SmsChatContact[]>([])
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setSelected(new Set())
    let cancelled = false
    setLoading(true)
    getChatContacts(supabase).then((data) => {
      if (!cancelled) {
        setContacts(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (selected.size < 2) return
    setCreating(true)
    await onCreate(name.trim() || 'Group chat', Array.from(selected))
    setCreating(false)
  }

  return (
    <Modal open={open} title="New Group" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Group name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grade 3 Parents"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>

        <div>
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Members {selected.size > 0 && `(${selected.size} selected)`}
          </p>
          {loading ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No one available to add yet.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {contacts.map((c) => {
                const active = selected.has(c.profile_id)
                return (
                  <button
                    key={c.profile_id}
                    type="button"
                    onClick={() => toggle(c.profile_id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                      active ? 'bg-primary-100 dark:bg-primary-950' : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary-200 dark:bg-primary-900 flex items-center justify-center font-bold text-primary-800 dark:text-primary-300 flex-shrink-0">
                      {c.first_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-stone-800 dark:text-stone-100">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs uppercase font-bold text-stone-400 dark:text-stone-600">{c.role}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex-shrink-0 ${
                        active ? 'bg-primary-600 border-primary-600' : 'border-stone-300 dark:border-stone-600'
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="primary"
          icon={<FiUsers />}
          disabled={selected.size < 2 || creating}
          onClick={handleCreate}
          fullWidth
        >
          {creating ? 'Creating...' : `Create Group${selected.size > 0 ? ` (${selected.size + 1})` : ''}`}
        </Button>
        {selected.size === 1 && (
          <p className="text-xs text-stone-400 dark:text-stone-500 text-center">
            Pick at least 2 people -- for just one, use &quot;New&quot; instead for a 1:1 chat.
          </p>
        )}
      </div>
    </Modal>
  )
}
