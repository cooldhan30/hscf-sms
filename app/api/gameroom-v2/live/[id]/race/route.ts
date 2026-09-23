import { NextResponse } from 'next/server'
import { requireLiveSessionAny } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { getRacingDifficultySettings, buildLiveRacersFromRows, rankLiveRacers, type RawRaceRow } from '@/lib/gameRoomV2/racing'

// GET /api/gameroom-v2/live/[id]/race -- the multiplayer race view
// BOTH every racer (via LivePlayClient -> RacingGame) and the host
// (via HostDashboardClient's live overview) poll. Racer distance is
// NEVER read from anything a client wrote -- it's recomputed here,
// every single request, by replaying each participant's own
// sms_gamev2_answers history (fetched via the SECURITY DEFINER RPC
// sms_gamev2_get_live_race_state, migration 081, since ordinary RLS
// only ever grants a student their OWN session/answers, not every
// other racer's) through the exact same tested
// replayRacerFromAnswers/tickRace pure functions solo Racing already
// runs. This is the concrete mechanism behind "server-authoritative
// score/progress" and "prevent race progress manipulation": a client
// has no position to spoof in the first place, since it never sends
// one.
//
// Network efficiency: this endpoint is polled at a low, HTTP-request
// cadence (see RacingGame.tsx's multiplayer branch, ~1.5s), NOT pushed
// over Realtime on every physics tick -- the response payload is a
// handful of small numbers per racer (distance/finished/effect), never
// full animation frames. Each client's own local Track.tsx animation
// (framer-motion's own smooth transition between the last-known and
// newly-polled distance) is what makes movement look continuous
// between polls -- "synchronize meaningful gameplay state and animate
// locally" applied directly.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionAny(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (liveSession.engine_id !== 'racing') {
    return NextResponse.json({ error: 'This live session is not a Racing session' }, { status: 409 })
  }

  const { data: rows, error } = (await supabase.rpc('sms_gamev2_get_live_race_state', {
    p_live_session_id: liveSession.id,
  })) as { data: RawRaceRow[] | null; error: { message: string } | null }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const settings = getRacingDifficultySettings(liveSession.race_difficulty)
  const raceStartMs = liveSession.started_at ? new Date(liveSession.started_at).getTime() : Date.now()
  const nowMs = Date.now()

  // The actual aggregation/replay/ranking pipeline lives in
  // lib/gameRoomV2/racing/liveRace.ts as pure functions -- directly
  // unit tested by scripts/verify-gameroom-v2-racing-multiplayer.ts
  // with synthetic multi-participant answer histories, so this route
  // is a thin fetch-then-compute wrapper rather than where the actual
  // multiplayer logic lives untested.
  const racers = buildLiveRacersFromRows(rows ?? [], raceStartMs, nowMs, settings)
  const ranked = rankLiveRacers(racers)

  return NextResponse.json({
    trackLength: settings.trackLength,
    liveSessionStatus: liveSession.status,
    racers: ranked,
  })
}
