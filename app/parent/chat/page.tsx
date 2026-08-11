import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { listConversations } from '@/lib/chat'
import { ChatApp } from '@/components/chat/ChatApp'

export const dynamic = 'force-dynamic'

export default async function ParentChatPage() {
  const { userId } = await auth()
  const supabase = createClient()
  const conversations = userId ? await listConversations(supabase, userId) : []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Chat</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Message your child&apos;s teachers.</p>
      </div>
      <ChatApp currentUserId={userId ?? ''} initialConversations={conversations} />
    </div>
  )
}
