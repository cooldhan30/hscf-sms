'use client'

import { useEffect, useState } from 'react'
import { FiPlus, FiUsers } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { ConversationList } from './ConversationList'
import { ChatThread } from './ChatThread'
import { ContactPicker } from './ContactPicker'
import { GroupChatModal } from './GroupChatModal'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { getOrCreateConversation, createGroupConversation, listConversations, type ConversationSummary } from '@/lib/chat'
import { toast } from '@/lib/toast'
import type { SmsChatContact } from '@/types/database'

// Single shared implementation mounted from a thin page.tsx under each
// role's dashboard (app/{teacher,student,parent}/chat/page.tsx) -- avoids
// three copy-pasted chat screens. Keeps list + thread in local state
// rather than a separate dynamic route per conversation, since there's
// nothing URL-shareable about a 1:1 thread here.
export function ChatApp({
  currentUserId,
  initialConversations,
}: {
  currentUserId: string
  initialConversations: ConversationSummary[]
}) {
  const supabase = useSupabaseBrowserClient()
  const [conversations, setConversations] = useState(initialConversations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [groupModalOpen, setGroupModalOpen] = useState(false)

  async function refresh() {
    const data = await listConversations(supabase, currentUserId)
    setConversations(data)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  async function handlePickContact(contact: SmsChatContact) {
    setPickerOpen(false)
    const result = await getOrCreateConversation(supabase, currentUserId, contact.profile_id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    await refresh()
    setSelectedId(result.id)
  }

  async function handleCreateGroup(name: string, memberIds: string[]) {
    const result = await createGroupConversation(supabase, { name, creatorId: currentUserId, memberIds })
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setGroupModalOpen(false)
    await refresh()
    setSelectedId(result.id)
  }

  const selected = conversations.find((c) => c.id === selectedId)
  const selectedTitle = selected
    ? selected.isGroup
      ? selected.name || 'Group chat'
      : selected.otherUser
        ? `${selected.otherUser.first_name} ${selected.otherUser.last_name}`
        : null
    : null

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
      <div className={selectedId ? 'hidden md:block' : ''}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-stone-800 dark:text-stone-100">Conversations</h2>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" icon={<FiUsers />} onClick={() => setGroupModalOpen(true)}>
              Group
            </Button>
            <Button type="button" variant="ghost" size="sm" icon={<FiPlus />} onClick={() => setPickerOpen(true)}>
              New
            </Button>
          </div>
        </div>
        <ConversationList conversations={conversations} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <div className={selectedId ? '' : 'hidden md:flex md:items-center md:justify-center'}>
        {selected && selectedTitle ? (
          <ChatThread
            key={selected.id}
            conversationId={selected.id}
            currentUserId={currentUserId}
            otherUserName={selectedTitle}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <p className="text-sm text-stone-400 dark:text-stone-600">Select a conversation, or start a new one.</p>
        )}
      </div>

      <ContactPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handlePickContact} />
      <GroupChatModal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} onCreate={handleCreateGroup} />
    </div>
  )
}
