import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { getGameModule } from '@/lib/gameRoom/registry'

// GET /api/game-room/history -- student-only. This student's own
// completed games (teacher-hosted and solo practice both included),
// newest first -- the "history of games, topic, and scores" view. RLS
// ("game_players: student manage own") already scopes this to just the
// caller's own rows.
export async function GET() {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const { data: rows, error } = await supabase
    .from('sms_game_players')
    .select('id, score, correct_count, answered_count, completed_at, session:sms_game_sessions(game_type, quiz_mode, category_filter, is_solo_practice)')
    .eq('student_id', student.id)
    .eq('completed', true)
    .order('completed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const history = (rows ?? []).map((row) => {
    const session = Array.isArray(row.session) ? row.session[0] : row.session
    const gameModule = session ? getGameModule(session.game_type) : undefined
    return {
      id: row.id,
      gameName: gameModule?.name ?? session?.game_type ?? 'Unknown',
      quizMode: session?.quiz_mode ?? null,
      category: session?.category_filter ?? null,
      isSoloPractice: session?.is_solo_practice ?? false,
      score: row.score,
      correctCount: row.correct_count,
      answeredCount: row.answered_count,
      accuracy: row.answered_count > 0 ? Number(((row.correct_count / row.answered_count) * 100).toFixed(1)) : 0,
      completedAt: row.completed_at,
    }
  })

  return NextResponse.json({ history })
}
