import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// Same "Realtime as a refetch trigger" idiom as lib/gameRoom/realtime.ts
// (subscribeToGameSession), including the setAuth()-before-subscribe
// ordering (Clerk's async getToken() can otherwise race .subscribe(),
// silently joining anonymously so RLS filters out every event with no
// visible error). Unlike the self-paced engine, Mayangoli subscribes
// BOTH host and student clients to this same channel shape -- a
// synchronized game needs every connected student to react the instant
// the room advances, not just the host dashboard.
export function subscribeToMayangoliSession(
  supabase: SupabaseClient,
  sessionId: string,
  onChanged: () => void
): RealtimeChannel {
  const channel = supabase
    .channel(`mayangoli-session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sms_mayangoli_players', filter: `session_id=eq.${sessionId}` },
      () => onChanged()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sms_mayangoli_sessions', filter: `id=eq.${sessionId}` },
      () => onChanged()
    )

  supabase.realtime.setAuth().then(() => {
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Mayangoli realtime subscription failed for session ${sessionId}:`, status, err)
      }
    })
  })

  return channel
}
