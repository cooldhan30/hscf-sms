import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireGamePlayer } from '@/lib/gameRoom/requirePlayer'
import { getGameModule } from '@/lib/gameRoom/registry'
import { shuffle } from '@/lib/gameRoom/shuffle'

// POST /api/game-room/state -- anonymous, polled every ~2-3s by the
// student client (mirrors the interval-poll idiom already proven in
// StoryGeneratorClient.tsx, chosen over anonymous Realtime subscriptions
// since this codebase has no precedent for the latter). Body:
// { playerToken }. Returns the session's status, this player's progress,
// and -- only if the game is active and this player hasn't completed --
// their CURRENT question with freshly shuffled options and server-
// computed remaining time. Never exposes a future question or the
// correct answer before it's answered (anti-cheat).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const guard = await requireGamePlayer(body.playerToken)
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, player, session } = guard

  const base = {
    sessionStatus: session.status,
    currentIndex: player.current_index,
    totalQuestions: player.question_order.length,
    score: player.score,
    completed: player.completed,
  }

  if (session.status !== 'active' || player.completed) {
    // Waiting/paused/ended, or this player already finished -- still
    // report their live rank so the "waiting for classmates" / finished
    // screen can show a rank that keeps updating as others answer.
    const rank = await computeRank(supabase, session.id, player.id)
    return NextResponse.json({ ...base, rank, question: null, remainingSeconds: null })
  }

  const gameModule = getGameModule(session.game_type)
  if (!gameModule) {
    return NextResponse.json({ error: 'Game module not found' }, { status: 500 })
  }

  const bank = gameModule.getQuestionBank()
  const bankById = new Map(bank.map((q) => [q.id, q]))
  const questionId = player.question_order[player.current_index]
  const question = bankById.get(questionId)

  if (!question) {
    return NextResponse.json({ error: 'Question not found in bank' }, { status: 500 })
  }

  const elapsedMs = Date.now() - new Date(player.current_question_started_at).getTime()
  const remainingSeconds = Math.max(0, session.question_time_limit_seconds - Math.floor(elapsedMs / 1000))

  const rank = await computeRank(supabase, session.id, player.id)

  return NextResponse.json({
    ...base,
    rank,
    remainingSeconds,
    question: {
      id: question.id,
      prompt: question.prompt,
      options: shuffle(question.options),
    },
  })
}

// A player's rank among all players in their session, by score
// descending -- recomputed on every poll rather than cached, since it
// changes continuously as other players answer. Cheap enough (one
// indexed query over a single session's players, capped at a realistic
// classroom size) to not warrant caching for this feature's scale.
async function computeRank(
  supabase: ReturnType<typeof createAdminClient>,
  sessionId: string,
  playerId: string
): Promise<number> {
  const { data: players } = await supabase
    .from('sms_game_players')
    .select('id, score')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })

  const index = (players ?? []).findIndex((p) => p.id === playerId)
  return index === -1 ? 0 : index + 1
}
