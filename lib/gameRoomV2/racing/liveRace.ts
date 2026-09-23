import { replayRacerFromAnswers, type AnswerEvent, type RacerState } from './race'
import type { RacingDifficultySettings } from './difficulty'

// The shape /api/gameroom-v2/live/[id]/race returns -- one entry per
// participant, server-computed (never client-reported) distance/
// finished/effect. Deliberately a SEPARATE type from RacerState (not
// reused as-is) because a live racer additionally carries
// participantId/hasSession/totalQuestions/currentIndex, which solo
// racing's RacerState has no notion of and shouldn't be made to carry
// just for this one caller.
export interface LiveRacer {
  participantId: string
  nickname: string
  hasSession: boolean
  totalQuestions: number
  currentIndex: number
  distance: number
  finished: boolean
  finishedAtMs: number | null
  effect: RacerState['effect']
}

export interface LiveRaceResponse {
  trackLength: number
  liveSessionStatus: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  racers: LiveRacer[]
}

// Converts the server's live-race response into the exact RaceState
// shape Track.tsx already knows how to render -- reusing that
// component as-is for multiplayer, rather than building a second track
// renderer, since the only real difference is WHERE racer positions
// come from (a poll response here, a local tick loop for solo).
// `myParticipantId` marks which racer is "you" (isPlayer: true) purely
// for Track.tsx's own bold-vs-dim label styling -- it has no gameplay
// effect, since every racer's distance is already server-computed
// identically regardless of whose screen is showing it.
export function liveRacersToRaceState(response: LiveRaceResponse, myParticipantId: string | null) {
  return {
    trackLength: response.trackLength,
    racers: response.racers.map(
      (r): RacerState => ({
        id: r.participantId,
        label: r.nickname,
        isPlayer: r.participantId === myParticipantId,
        distance: r.distance,
        effect: r.effect,
        finished: r.finished,
        finishedAtMs: r.finishedAtMs,
      })
    ),
  }
}

// One participant's raw row, exactly as
// sms_gamev2_get_live_race_state (migration 081) returns it -- one row
// per (participant, answer) via the RPC's LEFT JOINs, so a participant
// with 3 answers appears 3 times and a participant with none appears
// once with null answer fields. Extracted as its own type (rather than
// inlined in the API route) so the full multi-participant
// aggregation/replay/ranking pipeline below is unit-testable without a
// live database -- see scripts/verify-gameroom-v2-racing-multiplayer.ts.
export interface RawRaceRow {
  participant_id: string
  nickname: string
  session_id: string | null
  question_order_length: number | null
  current_index: number | null
  is_correct: boolean | null
  answered_at: string | null
}

// Groups raw RPC rows by participant, replays each one's answer
// history through replayRacerFromAnswers, and returns one LiveRacer
// per participant (unranked -- see rankLiveRacers below). This is the
// exact aggregation app/api/gameroom-v2/live/[id]/race/route.ts runs
// on every request; kept here as a pure function so a test can
// construct synthetic multi-participant answer histories directly,
// without needing a live Postgres connection.
export function buildLiveRacersFromRows(
  rows: RawRaceRow[],
  raceStartMs: number,
  nowMs: number,
  settings: RacingDifficultySettings
): LiveRacer[] {
  const byParticipant = new Map<string, RawRaceRow[]>()
  for (const row of rows) {
    const existing = byParticipant.get(row.participant_id)
    if (existing) existing.push(row)
    else byParticipant.set(row.participant_id, [row])
  }

  return Array.from(byParticipant.entries()).map(([participantId, participantRows]) => {
    const first = participantRows[0]
    const answers: AnswerEvent[] = participantRows
      .filter((r) => r.answered_at !== null && r.is_correct !== null)
      .map((r) => ({ isCorrect: r.is_correct!, atMs: new Date(r.answered_at!).getTime() }))
      .sort((a, b) => a.atMs - b.atMs)

    const replayed = first.session_id
      ? replayRacerFromAnswers(raceStartMs, nowMs, answers, settings)
      : { distance: 0, finished: false, finishedAtMs: null, effect: null }

    return {
      participantId,
      nickname: first.nickname,
      hasSession: first.session_id !== null,
      totalQuestions: first.question_order_length ?? 0,
      currentIndex: first.current_index ?? 0,
      distance: replayed.distance,
      finished: replayed.finished,
      finishedAtMs: replayed.finishedAtMs,
      effect: replayed.effect,
    }
  })
}

// Finish ordering: every finished racer sorts before every unfinished
// one, finished racers order by finishedAtMs ascending (who ACTUALLY
// finished first -- the one honest measure, never re-derived from
// distance once a racer is done), unfinished racers order by current
// distance descending (a live "who's ahead" standings while the race
// is still in progress). The exact same ordering both the in-progress
// track/leaderboard and the final MultiplayerFinishScreen use.
export function rankLiveRacers(racers: LiveRacer[]): LiveRacer[] {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishedAtMs ?? 0) - (b.finishedAtMs ?? 0)
    if (a.finished) return -1
    if (b.finished) return 1
    return b.distance - a.distance
  })
}
