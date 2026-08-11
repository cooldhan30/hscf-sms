import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { SmsChatContact, SmsMessage } from '@/types/database'

// Shared chat data-access layer, called from both server components
// (initial page load) and client components (sending, realtime) -- takes
// the caller's own supabase client explicitly rather than assuming a
// module-level singleton, since server/browser clients are constructed
// differently (lib/supabase/server.ts vs lib/supabase/client.ts).

interface ChatParticipant {
  id: string
  first_name: string
  last_name: string
  role: string
}

export interface ConversationSummary {
  id: string
  isGroup: boolean
  name: string | null
  // 1:1 only -- the other participant. Null for groups (use
  // `participants` instead) or if the other side's profile is somehow
  // unreadable.
  otherUser: ChatParticipant | null
  // All participants except the caller. Populated for both 1:1 and
  // group conversations (1:1 just has exactly one entry, same person as
  // otherUser) so the UI has one shape to render group membership from.
  participants: ChatParticipant[]
  lastMessage: { content: string; created_at: string; sender_id: string } | null
  unreadCount: number
}

// Conversation ids are normalized user_a < user_b (see 017_chat_system.sql),
// so the pair dedupes regardless of who initiates. Groups don't use
// user_a/user_b at all (see 028_group_chat.sql).
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export async function getOrCreateConversation(
  supabase: SupabaseClient,
  currentUserId: string,
  otherUserId: string
): Promise<{ id: string } | { error: string }> {
  const [userA, userB] = orderedPair(currentUserId, otherUserId)

  const { data: existing } = await supabase
    .from('sms_conversations')
    .select('id')
    .eq('user_a', userA)
    .eq('user_b', userB)
    .maybeSingle()

  if (existing) return { id: existing.id }

  // The id is generated client-side (rather than left to the column's
  // DB default + read back via .select()) so we never need to SELECT
  // the row before its participants exist. Since 028_group_chat.sql,
  // the SELECT policy on sms_conversations requires a matching
  // sms_conversation_participants row -- immediately reading back a
  // just-inserted conversation via .select().single() (as this used to)
  // fails that check for a conversation with zero participants yet, and
  // Postgres reports that as "new row violates row-level security
  // policy" on the INSERT itself (RETURNING re-checks SELECT visibility).
  // Confirmed as a real bug hit by group chat creation: 2026-08-05.
  const id = crypto.randomUUID()

  // RLS ("conversations: create 1:1 if related") enforces
  // sms_can_chat(user_a, user_b) -- an unrelated pair gets rejected here,
  // not just hidden in the UI.
  const { error } = await supabase.from('sms_conversations').insert([{ id, user_a: userA, user_b: userB }])
  if (error) {
    return { error: error.message || 'You are not able to message this person' }
  }

  const { error: participantsError } = await supabase
    .from('sms_conversation_participants')
    .insert([
      { conversation_id: id, user_id: userA },
      { conversation_id: id, user_id: userB },
    ])
  if (participantsError) {
    return { error: participantsError.message }
  }

  return { id }
}

// Creates a new group conversation and adds the given members alongside
// the creator. RLS (see 028_group_chat.sql) independently re-checks that
// every added member is someone the creator could legitimately 1:1 chat
// with -- an unrelated id in memberIds gets rejected here, same
// defense-in-depth as getOrCreateConversation above.
export async function createGroupConversation(
  supabase: SupabaseClient,
  { name, creatorId, memberIds }: { name: string; creatorId: string; memberIds: string[] }
): Promise<{ id: string } | { error: string }> {
  const id = crypto.randomUUID()

  const { error } = await supabase.from('sms_conversations').insert([{ id, is_group: true, name, created_by: creatorId }])
  if (error) {
    return { error: error.message || 'Failed to create group' }
  }

  const rows = [creatorId, ...memberIds].map((user_id) => ({ conversation_id: id, user_id }))
  const { error: participantsError } = await supabase.from('sms_conversation_participants').insert(rows)

  if (participantsError) {
    // Best-effort cleanup -- the conversation row is useless without its
    // participants, and RLS means only the creator (who just made it)
    // could ever have deleted it anyway.
    await supabase.from('sms_conversations').delete().eq('id', id)
    return { error: participantsError.message }
  }

  return { id }
}

export async function listConversations(supabase: SupabaseClient, currentUserId: string): Promise<ConversationSummary[]> {
  const { data: myRows } = await supabase
    .from('sms_conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  const conversationIds = (myRows ?? []).map((r) => r.conversation_id)
  if (conversationIds.length === 0) return []

  const [{ data: conversations }, { data: allParticipants }, { data: lastMessages }, { data: unread }] = await Promise.all([
    supabase
      .from('sms_conversations')
      .select('id, is_group, name, last_message_at')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('sms_conversation_participants')
      .select('conversation_id, user:sms_profiles(id, first_name, last_name, role)')
      .in('conversation_id', conversationIds)
      .returns<{ conversation_id: string; user: ChatParticipant }[]>(),
    supabase
      .from('sms_messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('sms_messages')
      .select('conversation_id')
      .in('conversation_id', conversationIds)
      .is('read_at', null)
      .neq('sender_id', currentUserId),
  ])

  const participantsByConversation = new Map<string, ChatParticipant[]>()
  for (const row of allParticipants ?? []) {
    if (!row.user || row.user.id === currentUserId) continue
    const list = participantsByConversation.get(row.conversation_id) ?? []
    list.push(row.user)
    participantsByConversation.set(row.conversation_id, list)
  }

  const lastMessageByConversation = new Map<string, { content: string; created_at: string; sender_id: string }>()
  for (const m of lastMessages ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) lastMessageByConversation.set(m.conversation_id, m)
  }
  const unreadCountByConversation = new Map<string, number>()
  for (const m of unread ?? []) {
    unreadCountByConversation.set(m.conversation_id, (unreadCountByConversation.get(m.conversation_id) ?? 0) + 1)
  }

  return (conversations ?? []).map((c) => {
    const participants = participantsByConversation.get(c.id) ?? []
    return {
      id: c.id,
      isGroup: c.is_group,
      name: c.name,
      otherUser: !c.is_group ? (participants[0] ?? null) : null,
      participants,
      lastMessage: lastMessageByConversation.get(c.id) ?? null,
      unreadCount: unreadCountByConversation.get(c.id) ?? 0,
    }
  })
}

export async function getMessages(supabase: SupabaseClient, conversationId: string): Promise<SmsMessage[]> {
  const { data } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function sendMessage(
  supabase: SupabaseClient,
  { conversationId, senderId, content }: { conversationId: string; senderId: string; content: string }
): Promise<{ message?: SmsMessage; error?: string }> {
  // .select().single() so the sender can append their own message to the
  // UI immediately -- ChatThread doesn't wait on the Realtime echo for
  // that (Realtime may lag, and shouldn't be a requirement for the
  // sender to see what they just sent).
  const { data, error } = await supabase
    .from('sms_messages')
    .insert([{ conversation_id: conversationId, sender_id: senderId, content }])
    .select()
    .single()
  return { message: data ?? undefined, error: error?.message }
}

export async function markRead(supabase: SupabaseClient, conversationId: string, currentUserId: string): Promise<void> {
  await supabase
    .from('sms_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .is('read_at', null)
    .neq('sender_id', currentUserId)
}

// Realtime is enforced by the same RLS as reads (Supabase filters
// postgres_changes payloads per-connection using the subscriber's SELECT
// policy) -- an unfiltered subscription still only ever delivers messages
// the caller is actually a participant in.
//
// Returns the channel synchronously (subscribing happens in the
// background) so the caller can store it for cleanup immediately, rather
// than awaiting a promise before it has anything to remove. That matters
// because supabase-realtime-js reuses an existing channel object for a
// topic that's already registered: if a caller instead awaited setAuth()
// before creating the channel (as this used to), a fast unmount+remount
// (e.g. React StrictMode in dev, or quickly switching conversations)
// could have a second effect run create/subscribe a channel for the same
// topic before the first effect's cleanup had anything to tear down --
// the second `.on()` call would then throw "cannot add postgres_changes
// callbacks ... after subscribe()" as an unhandled rejection, and the
// first effect's deferred cleanup would remove the only channel that had
// actually subscribed, leaving the page with no working subscription at
// all (reproduced during production-readiness testing: 2026-08).
export function subscribeToConversation(
  supabase: SupabaseClient,
  conversationId: string,
  onMessage: (message: SmsMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sms_messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(payload.new as SmsMessage)
    )

  // realtime-js sends whatever accessTokenValue is cached (possibly none
  // yet) the instant .subscribe() is called -- with our async accessToken
  // callback (Clerk's getToken()), that can race ahead of the token
  // actually being fetched, so the channel joins as the anonymous
  // Postgres role and RLS silently filters out every event. Awaiting
  // setAuth() first guarantees the token is attached to the join.
  supabase.realtime.setAuth().then(() => {
    channel.subscribe((status, err) => {
      // .subscribe() otherwise fails completely silently -- this is
      // exactly how the Clerk-session-token-missing-a-role-claim issue
      // stayed invisible (the join was rejected server-side, and
      // nothing in the app surfaced that as an error anywhere).
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Chat realtime subscription failed for conversation ${conversationId}:`, status, err)
      }
    })
  })

  return channel
}

// Subscribed once per logged-in user to ALL of their conversations (not
// per-open-thread), so a badge/notification can update even when the
// user isn't viewing that specific thread. Same synchronous-return shape
// as subscribeToConversation, for the same cleanup-ordering reason.
export function subscribeToAllMessages(supabase: SupabaseClient, onMessage: (message: SmsMessage) => void): RealtimeChannel {
  const channel = supabase
    .channel('all-messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sms_messages' }, (payload) =>
      onMessage(payload.new as SmsMessage)
    )

  supabase.realtime.setAuth().then(() => {
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('Chat realtime subscription (all-messages) failed:', status, err)
      }
    })
  })

  return channel
}

export async function getChatContacts(supabase: SupabaseClient): Promise<SmsChatContact[]> {
  const { data } = await supabase.rpc('sms_chat_contacts')
  return data ?? []
}
