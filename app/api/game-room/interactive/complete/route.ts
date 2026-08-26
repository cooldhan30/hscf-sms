import { NextResponse } from 'next/server'
import { requireGamePlayer } from '@/lib/gameRoom/requirePlayer'
import { getInteractiveGameModule } from '@/lib/gameRoom/registry'

// POST /api/game-room/interactive/complete -- student-only. Body:
// { sessionId, score, correctCount }. The ONE terminal write for a solo
// interactive game -- there is no per-step scoring the way the quiz
// engine's /answer has, since completion is defined purely client-side
// (all 12 tiles correctly placed / all 12 pairs matched) and there's no
// adversarial-scoring concern for a solo, non-competitive practice game
// the way there is for a live class quiz. Still validates score against
// the module's maxScore server-side as a basic sanity guard.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireGamePlayer(body.sessionId)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, player, session } = guard

  if (session.status !== 'active') {
    return NextResponse.json({ error: `Cannot complete -- game is "${session.status}"` }, { status: 409 })
  }
  if (player.completed) {
    return NextResponse.json({ error: 'This game has already been completed' }, { status: 409 })
  }

  const gameModule = getInteractiveGameModule(session.game_type)
  if (!gameModule) {
    return NextResponse.json({ error: 'Game module not found' }, { status: 500 })
  }

  const score = Number(body.score)
  const correctCount = Number(body.correctCount)
  if (!Number.isInteger(score) || score < 0 || score > gameModule.maxScore) {
    return NextResponse.json({ error: 'Invalid score' }, { status: 400 })
  }
  if (!Number.isInteger(correctCount) || correctCount < 0 || correctCount > gameModule.maxScore) {
    return NextResponse.json({ error: 'Invalid correctCount' }, { status: 400 })
  }

  const { error: updatePlayerError } = await supabase
    .from('sms_game_players')
    .update({
      score,
      correct_count: correctCount,
      answered_count: gameModule.maxScore,
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('id', player.id)

  if (updatePlayerError) {
    return NextResponse.json({ error: updatePlayerError.message }, { status: 400 })
  }

  await supabase
    .from('sms_game_sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'active')

  return NextResponse.json({ success: true })
}
