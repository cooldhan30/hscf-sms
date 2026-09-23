import { NextResponse } from 'next/server'
import { requireLiveSessionAny } from '@/lib/gameRoomV2/liveClassroom/requireLiveSession'
import { getBossBattleDifficultySettings, buildCoopBattleState, rankCoopContributions, type ParticipantAnswerSummary } from '@/lib/gameRoomV2/bossBattle'

// GET /api/gameroom-v2/live/[id]/boss-battle -- the cooperative battle
// view BOTH every attacker (via LivePlayClient -> BossBattleGame) and
// the host (via HostDashboardClient's live overview) poll. Boss HP is
// NEVER read from anything a client wrote -- it's recomputed here,
// every single request, from the SUM of every participant's already-
// persisted correct-answer counts (fetched via the SECURITY DEFINER
// RPC sms_gamev2_get_live_boss_battle_state, migration 082, since
// ordinary RLS only ever grants a student their OWN session row, not
// every other attacker's) through
// lib/gameRoomV2/bossBattle/coopBattle.ts's buildCoopBattleState. This
// is the concrete mechanism behind "authoritative boss HP" and
// "synchronized damage": a client has no damage figure to spoof, since
// it never reports one -- only correctness feedback for ITS OWN
// answer, exactly like every other engine's existing /answer route.
//
// Network efficiency: polled at a coarse ~1.5s HTTP cadence (see
// BossBattleGame.tsx's multiplayer branch), never pushed over Realtime
// on every tick -- the payload is a handful of numbers (boss HP,
// phase, per-participant damage dealt), never animation frames. Each
// client animates its own hit-flash/health-bar transition locally
// between polls.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireLiveSessionAny(params.id)
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, liveSession } = guard

  if (liveSession.engine_id !== 'boss-battle') {
    return NextResponse.json({ error: 'This live session is not a Boss Battle session' }, { status: 409 })
  }
  if (!liveSession.boss_id) {
    return NextResponse.json({ error: 'No boss was configured for this live session' }, { status: 409 })
  }

  const { data: rows, error } = (await supabase.rpc('sms_gamev2_get_live_boss_battle_state', {
    p_live_session_id: liveSession.id,
  })) as {
    data: { participant_id: string; nickname: string; correct_count: number; current_streak: number; best_streak: number }[] | null
    error: { message: string } | null
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const settings = getBossBattleDifficultySettings(liveSession.boss_difficulty)
  const participants: ParticipantAnswerSummary[] = (rows ?? []).map((r) => ({
    participantId: r.participant_id,
    nickname: r.nickname,
    correctCount: r.correct_count,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
  }))

  // The actual aggregation logic lives in
  // lib/gameRoomV2/bossBattle/coopBattle.ts as pure functions --
  // directly unit tested with synthetic multi-participant data rather
  // than only living in this route.
  const battle = buildCoopBattleState(liveSession.boss_id, settings, participants)
  const ranked = rankCoopContributions(battle.contributions)

  return NextResponse.json({
    liveSessionStatus: liveSession.status,
    boss: { id: battle.boss.id, name: battle.boss.name, tamilName: battle.boss.tamilName, phases: battle.boss.phases },
    bossHealth: battle.bossHealth,
    bossMaxHealth: battle.bossMaxHealth,
    bossPhaseIndex: battle.bossPhaseIndex,
    victory: battle.victory,
    totalDamageDealt: battle.totalDamageDealt,
    contributions: ranked,
  })
}
