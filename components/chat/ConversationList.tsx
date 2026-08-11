import { FiMessageCircle, FiUsers } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import type { ConversationSummary } from '@/lib/chat'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  parent: 'Parent',
  pending: '',
}

function conversationTitle(c: ConversationSummary): string {
  if (c.isGroup) return c.name || 'Group chat'
  return c.otherUser ? `${c.otherUser.first_name} ${c.otherUser.last_name}` : 'Unknown user'
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (conversations.length === 0) {
    return <EmptyState icon={FiMessageCircle} title="No conversations yet" description="Start a new chat to get going." />
  }

  return (
    <div className="space-y-1">
      {conversations.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
            selectedId === c.id
              ? 'bg-primary-100 dark:bg-primary-950'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-primary-200 dark:bg-primary-900 flex items-center justify-center font-bold text-primary-800 dark:text-primary-300 flex-shrink-0">
            {c.isGroup ? <FiUsers className="w-4 h-4" /> : c.otherUser ? c.otherUser.first_name[0] : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-stone-800 dark:text-stone-100 truncate">{conversationTitle(c)}</p>
              {!c.isGroup && c.otherUser && (
                <span className="text-[10px] uppercase font-bold text-stone-400 dark:text-stone-600 flex-shrink-0">
                  {ROLE_LABEL[c.otherUser.role]}
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 truncate">
              {c.lastMessage?.content ?? 'No messages yet'}
            </p>
          </div>
          {c.unreadCount > 0 && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-terracotta-600 text-white text-xs font-bold flex items-center justify-center">
              {c.unreadCount}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
