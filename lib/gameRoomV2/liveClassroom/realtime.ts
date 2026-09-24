'use client'

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

// Forked from lib/gameRoom/realtime.ts's subscribeToGameSession rather
// than imported -- same isolation rationale as every other V2 fork
// (lib/gameRoomV2/shuffle.ts, scoring.ts). Same proven idiom, including
// the setAuth()-before-subscribe() ordering: realtime-js sends whatever
// accessTokenValue is cached the instant .subscribe() is called, and
// with Clerk's async getToken() callback that can race ahead of the
// token actually being fetched -- silently joining as anonymous and
// having every event filtered out by RLS with no visible error.
//
// Subscribes to BOTH the live session's own status changes (LOBBY ->
// ACTIVE/PAUSED/ENDED) and every participant row change (join/leave/
// presence) for one live session -- used by both the teacher's host
// dashboard and a student's own lobby/waiting-room view, since both
// need the identical two signals (who's here, has it started).
//
// `includeParticipants: false` subscribes to the session row only. A
// student who is already mid-game never shows the roster, and every
// participant's heartbeat is an UPDATE on the participants table -- so
// staying subscribed to it during gameplay just delivers a steady stream
// of events nobody renders (see lib/gameRoomV2/gameplay/coalesce.ts).
// Callers should also coalesce `onChange`, since bursts are normal.
export function subscribeToLiveSession(
  supabase: SupabaseClient,
  liveSessionId: string,
  onChange: () => void,
  { includeParticipants = true }: { includeParticipants?: boolean } = {}
): RealtimeChannel {
  let channel = supabase.channel(`gamev2-live-session:${liveSessionId}:${includeParticipants ? 'all' : 'session'}`)
  if (includeParticipants) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sms_gamev2_live_participants', filter: `live_session_id=eq.${liveSessionId}` },
      () => onChange()
    )
  }
  channel = channel.on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'sms_gamev2_live_sessions', filter: `id=eq.${liveSessionId}` },
    () => onChange()
  )

  supabase.realtime.setAuth().then(() => {
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error(`GameRoom V2 live session realtime subscription failed for ${liveSessionId}:`, status, err)
      }
    })
  })

  return channel
}
