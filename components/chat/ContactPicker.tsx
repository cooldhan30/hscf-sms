'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/dashboard/Modal'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { getChatContacts } from '@/lib/chat'
import type { SmsChatContact } from '@/types/database'

// Lists only sms_chat_contacts() results, not a free-text search over
// every user in the system -- this keeps the relationship restriction
// visible in the UI itself, not just enforced silently by RLS on insert.
export function ContactPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (contact: SmsChatContact) => void
}) {
  const supabase = useSupabaseBrowserClient()
  const [contacts, setContacts] = useState<SmsChatContact[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
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

  return (
    <Modal open={open} title="New Chat" onClose={onClose}>
      {loading ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Loading...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">No one available to message yet.</p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {contacts.map((c) => (
            <button
              key={c.profile_id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <div className="w-9 h-9 rounded-full bg-primary-200 dark:bg-primary-900 flex items-center justify-center font-bold text-primary-800 dark:text-primary-300 flex-shrink-0">
                {c.first_name[0]}
              </div>
              <div>
                <p className="font-medium text-stone-800 dark:text-stone-100">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-xs uppercase font-bold text-stone-400 dark:text-stone-600">{c.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
