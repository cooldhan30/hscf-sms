'use client'

import { useEffect, useRef, useState } from 'react'
import { FiArrowLeft, FiSend } from 'react-icons/fi'
import { useSupabaseBrowserClient } from '@/lib/supabase/client'
import { getMessages, markRead, sendMessage, subscribeToConversation, type ConversationSummary } from '@/lib/chat'
import type { SmsMessage } from '@/types/database'

export function ChatThread({
  conversationId,
  currentUserId,
  otherUserName,
  isGroup,
  participants,
  onBack,
}: {
  conversationId: string
  currentUserId: string
  otherUserName: string
  isGroup: boolean
  participants: ConversationSummary['participants']
  onBack: () => void
}) {
  const supabase = useSupabaseBrowserClient()
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Guards against a message we just sent (which lands in the initial
  // fetch's response) being appended a second time when its own INSERT
  // event echoes back over the realtime channel.
  const knownIds = useRef(new Set<string>())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const data = await getMessages(supabase, conversationId)
      if (cancelled) return
      knownIds.current = new Set(data.map((m) => m.id))
      setMessages(data)
      setLoading(false)
      await markRead(supabase, conversationId, currentUserId)
    }
    load()

    const channel = subscribeToConversation(supabase, conversationId, (message) => {
      if (knownIds.current.has(message.id)) return
      knownIds.current.add(message.id)
      setMessages((prev) => [message, ...prev])
      if (message.sender_id !== currentUserId) {
        markRead(supabase, conversationId, currentUserId)
      }
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, currentUserId])

  async function handleSend() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setText('')
    const { message, error } = await sendMessage(supabase, { conversationId, senderId: currentUserId, content })
    setSending(false)
    if (error || !message) {
      setText(content)
      return
    }
    // Append directly rather than waiting on the Realtime echo -- the
    // sender seeing their own sent message shouldn't depend on Realtime
    // being connected. knownIds still guards against a duplicate if the
    // echo does arrive.
    if (!knownIds.current.has(message.id)) {
      knownIds.current.add(message.id)
      setMessages((prev) => [message, ...prev])
    }
  }

  // Group threads label each run of messages with who sent it; a 1:1
  // thread already names the other person in the header.
  const nameById = new Map(participants.map((p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]))

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col h-[70vh] rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 dark:border-stone-800">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 md:hidden"
        >
          <FiArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="font-bold text-stone-800 dark:text-stone-100">{otherUserName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col-reverse px-4 py-3 gap-2">
        {loading ? (
          <p className="text-sm text-stone-400 dark:text-stone-600 text-center py-6">Loading...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-600 text-center py-6">Say hello to {otherUserName}!</p>
        ) : (
          messages.map((m, i) => {
            const isMine = m.sender_id === currentUserId
            // messages is newest-first, so i + 1 is the one sent just before
            const showSender = isGroup && !isMine && messages[i + 1]?.sender_id !== m.sender_id
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {showSender && (
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-0.5 ml-1">
                    {nameById.get(m.sender_id) ?? 'Former member'}
                  </p>
                )}
                <div
                  className={`max-w-[75%] px-3.5 py-2 rounded-2xl ${
                    isMine
                      ? 'bg-primary-700 text-white dark:bg-primary-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-100'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70' : 'text-stone-400 dark:text-stone-500'}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="flex items-center gap-2 p-3 border-t border-stone-200 dark:border-stone-800">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Message"
          className="flex-1 px-4 py-2 rounded-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="p-2.5 rounded-full bg-primary-700 text-white disabled:opacity-50 hover:bg-primary-800 transition-colors flex-shrink-0"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
