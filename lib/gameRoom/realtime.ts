import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// Teacher-side only -- mirrors lib/chat.ts's subscribeToConversation
// exactly, including the setAuth()-before-subscribe ordering (realtime-js
// sends whatever accessTokenValue is cached the instant .subscribe() is
// called; with Clerk's async getToken() callback that can race ahead of
// the token actually being fetched, silently joining as anonymous and
// having every event filtered out by RLS with no visible error). The
// channel is returned synchronously so a fast unmount+remount (e.g. React
// StrictMode) can't create two channels for the same topic before the
// first's cleanup runs -- same reasoning as lib/chat.ts.
//
// Anonymous student clients do NOT use this -- they have no Clerk JWT to
// authenticate a Realtime channel with, so they poll /api/game-room/state
// instead (see app/play/[sessionId]/PlayGameClient.tsx).
export function subscribeToGameSession(
  supabase: SupabaseClient,
  sessionId: string,
  onPlayersChanged: () => void
): RealtimeChannel {
  const channel = supabase
    .channel(`game-session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sms_game_players', filter: `session_id=eq.${sessionId}` },
      () => onPlayersChanged()
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sms_game_sessions', filter: `id=eq.${sessionId}` },
      () => onPlayersChanged()
    )

  supabase.realtime.setAuth().then(() => {
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`Game Room realtime subscription failed for session ${sessionId}:`, status, err)
      }
    })
  })

  return channel
}
