import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { getGameModule } from '@/lib/gameRoom/registry'

// GET /api/game-room/sessions/[id] -- teacher-only. Session + all
// players + live aggregates (completed/playing counts, average score/
// accuracy, per-category accuracy). RLS ("game_sessions: host reads
// own") scopes this to the caller's own session -- a 404 here means
// either it doesn't exist or it isn't this teacher's. This is the host
// dashboard's initial paint before its Realtime subscription's first
// event arrives, and also its REST fallback.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { data: session, error: sessionError } = await supabase
    .from('sms_game_sessions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Game session not found' }, { status: 404 })
  }

  const { data: players } = await supabase
    .from('sms_game_players')
    .select('*')
    .eq('session_id', params.id)
    .order('score', { ascending: false })

  const playerRows = players ?? []
  const completedCount = playerRows.filter((p) => p.completed).length
  const totalAnswered = playerRows.reduce((sum, p) => sum + p.answered_count, 0)
  const totalCorrect = playerRows.reduce((sum, p) => sum + p.correct_count, 0)
  const avgScore = playerRows.length > 0 ? Math.round(playerRows.reduce((sum, p) => sum + p.score, 0) / playerRows.length) : 0
  const avgAccuracy = totalAnswered > 0 ? Number(((totalCorrect / totalAnswered) * 100).toFixed(1)) : 0

  // Per-category accuracy (only meaningful for modules with a category
  // concept) -- computed from sms_game_answers, which is why that table
  // has no direct teacher-read RLS policy: this route (using the
  // teacher's own RLS-scoped client, since it already owns the session)
  // reads it filtered to just this session's players.
  let categoryAccuracy: { category: string; label: string; accuracy: number }[] = []
  const gameModule = getGameModule(session.game_type)
  if (gameModule?.categories && gameModule.categories.length > 0 && playerRows.length > 0) {
    const playerIds = playerRows.map((p) => p.id)
    const { data: answers } = await supabase
      .from('sms_game_answers')
      .select('question_id, is_correct')
      .in('player_id', playerIds)

    const bank = gameModule.getQuestionBank()
    const categoryById = new Map(bank.map((q) => [q.id, q.category]))

    categoryAccuracy = gameModule.categories.map((cat) => {
      const catAnswers = (answers ?? []).filter((a) => categoryById.get(a.question_id) === cat.id)
      const correct = catAnswers.filter((a) => a.is_correct).length
      return {
        category: cat.id,
        label: cat.label,
        accuracy: catAnswers.length > 0 ? Number(((correct / catAnswers.length) * 100).toFixed(1)) : 0,
      }
    })
  }

  return NextResponse.json({
    session,
    players: playerRows,
    stats: {
      totalPlayers: playerRows.length,
      completedCount,
      playingCount: playerRows.length - completedCount,
      avgScore,
      avgAccuracy,
    },
    categoryAccuracy,
  })
}
