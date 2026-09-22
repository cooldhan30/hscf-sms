// A participant's `connected` DB column is the LAST-WRITTEN presence
// state (flipped by join/heartbeat/explicit-leave), but the
// authoritative "is this student actually still here right now" check
// also needs to catch a client that silently vanished (closed the tab
// without the unmount handler firing, lost network, force-quit) --
// this is a pure function of "how long ago was their last heartbeat",
// so the same rule can be applied both when rendering a lobby roster
// and when deciding whether to exclude a participant from
// sms_gamev2_start_live_session's "every currently-connected
// participant" scan.
//
// A generous threshold (not a tight one) is deliberate: a real
// classroom's wifi/tab-switching hiccups are common and brief -- this
// should tolerate a normal blip, not flicker a student's presence dot
// on every momentary network stutter.
const HEARTBEAT_STALE_AFTER_MS = 15_000

export function isPresenceStale(lastSeenAtIso: string, nowMs: number = Date.now()): boolean {
  const lastSeenMs = new Date(lastSeenAtIso).getTime()
  return nowMs - lastSeenMs > HEARTBEAT_STALE_AFTER_MS
}

// A participant counts as genuinely present only if BOTH their stored
// `connected` flag is true AND their heartbeat isn't stale -- a
// participant who explicitly left (connected=false) stays absent even
// with a fresh heartbeat somehow still arriving (a stale request
// racing a leave), and a participant who never explicitly left but
// went quiet is still correctly treated as gone.
export function isPresentlyConnected(participant: { connected: boolean; lastSeenAt: string }, nowMs: number = Date.now()): boolean {
  return participant.connected && !isPresenceStale(participant.lastSeenAt, nowMs)
}
