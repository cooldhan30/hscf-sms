import { NextResponse } from 'next/server'
import { requireGamePlayer } from '@/lib/gameRoom/requirePlayer'
import { getGameModule } from '@/lib/gameRoom/registry'

// POST /api/game-room/review -- student-only. Body: { sessionId }.
// Post-game review: every question this player was asked, their chosen
// answer, the correct answer, and whether it was right -- so a student
// can see exactly where they went wrong after finishing, not just their
// final score. sms_game_answers only stores question_id/selected_answer/
// is_correct/points (no question text/options), so this re-resolves
// each answer against the module's static question bank, the same
// bankById lookup already used in answer/route.ts and state/route.ts.
//
// Available once this player has answered at least one question --
// doesn't require the whole SESSION to have ended, since a solo
// practice run's player can complete before/without a session-level
// "ended" transition, and there's no reason to make a student wait for
// classmates just to review their own answers.
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

  const gameModule = getGameModule(session.game_type)
  if (!gameModule) {
    return NextResponse.json({ error: 'Game module not found' }, { status: 500 })
  }
  const bankById = new Map(gameModule.getQuestionBank().map((q) => [q.id, q]))

  // RLS ("game_answers: student manage own") already scopes this to the
  // caller's own answers -- no need to also filter by player_id here,
  // but it's included anyway for clarity and to stay correct even if a
  // student somehow has answer rows from more than one player identity.
  const { data: answers } = await supabase
    .from('sms_game_answers')
    .select('question_id, question_index, selected_answer, is_correct, points, answered_at')
    .eq('player_id', player.id)
    .order('question_index', { ascending: true })

  const review = (answers ?? []).map((a) => {
    const question = bankById.get(a.question_id)
    return {
      questionIndex: a.question_index,
      prompt: question?.prompt ?? '(question no longer available)',
      options: question?.options ?? [],
      selectedAnswer: a.selected_answer,
      correctAnswer: question?.correctAnswer ?? null,
      isCorrect: a.is_correct,
      points: a.points,
      explanation: question?.explanation ?? null,
      category: question?.category ?? null,
      categoryLabel: gameModule.categories?.find((c) => c.id === question?.category)?.label ?? null,
    }
  })

  return NextResponse.json({
    gameName: gameModule.name,
    score: player.score,
    correctCount: player.correct_count,
    totalCount: player.answered_count,
    review,
  })
}
