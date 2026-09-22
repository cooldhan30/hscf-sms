export type LiveSessionStatus = 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'

// Pure state-machine rules for the live session lifecycle -- extracted
// from app/api/gameroom-v2/live/join/route.ts and
// app/gameroom-v2/live/play/[id]/LivePlayClient.tsx so the actual
// transition/visibility rules are independently unit-testable rather
// than only verifiable by reading route bodies. These are the concrete
// rules behind the requested lifecycle:
//   Teacher: create -> LOBBY -> start -> ACTIVE -> (pause/resume) ->
//     PAUSED/ACTIVE -> end -> ENDED
//   Student: join code works at LOBBY/ACTIVE/PAUSED (late join), never
//     ENDED; gameplay renders at ACTIVE/PAUSED once bridged, the lobby
//     waiting room renders at LOBBY (or before bridging).

// A join code resolves successfully at any status except ENDED -- the
// concrete rule behind "late join" and "reconnect after the host
// already started": only a session that has definitively concluded
// refuses new/returning participants.
export function canJoinByCode(status: LiveSessionStatus): boolean {
  return status !== 'ENDED'
}

// Whether joining at this status requires the late-join bridge RPC
// (sms_gamev2_join_active_live_session, migration 080) rather than
// waiting for the host's own bulk sms_gamev2_start_live_session to
// create every participant's session row at once.
export function requiresLateJoinBridge(status: LiveSessionStatus): boolean {
  return status === 'ACTIVE' || status === 'PAUSED'
}

// Whether the host's Start action is legal from this status -- only
// ever from LOBBY; starting twice, or starting an already-ended
// session, is always rejected.
export function canStart(status: LiveSessionStatus): boolean {
  return status === 'LOBBY'
}

export function canPause(status: LiveSessionStatus): boolean {
  return status === 'ACTIVE'
}

export function canResume(status: LiveSessionStatus): boolean {
  return status === 'PAUSED'
}

// End is legal from every non-terminal status -- a teacher can end a
// live session before it even starts (LOBBY, e.g. wrong question set
// selected) exactly as validly as mid-game (ACTIVE/PAUSED).
export function canEnd(status: LiveSessionStatus): boolean {
  return status !== 'ENDED'
}

// Whether a participant with a bridged sessionId should render actual
// gameplay (their per-engine play component) rather than the lobby
// waiting room -- true for ACTIVE and PAUSED (a paused game still
// shows the frozen board/HUD, not a "waiting for teacher" screen),
// false for LOBBY/ENDED.
export function shouldRenderGameplay(status: LiveSessionStatus, hasSessionId: boolean): boolean {
  return hasSessionId && (status === 'ACTIVE' || status === 'PAUSED')
}

// STALE ROOMS: this codebase has no cron/worker infrastructure (see
// migrations 012/013's own precedent -- staleness is checked lazily at
// read time, never swept by a background job) -- a live session the
// host never returns to (closed the tab mid-LOBBY, or an ACTIVE
// session where the host's own client crashed) is detected the same
// lazy way here: a generous age threshold past which a non-ENDED
// session is treated as abandoned rather than genuinely in progress. 4
// hours comfortably exceeds any real class period (even a long block
// schedule), so this only ever fires for a room that's truly been
// forgotten, never a session that's just running a long review
// activity.
const STALE_ROOM_AFTER_MS = 4 * 60 * 60 * 1000

export function isLiveSessionStale(status: LiveSessionStatus, createdAtIso: string, nowMs: number = Date.now()): boolean {
  if (status === 'ENDED') return false
  const ageMs = nowMs - new Date(createdAtIso).getTime()
  return ageMs > STALE_ROOM_AFTER_MS
}
