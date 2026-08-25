import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'

// GET /api/game-room/my-stats -- student-only. This student's own
// aggregate (total points/games played/accuracy across teacher-hosted
// games only, per the confirmed "solo practice doesn't affect rank"
// rule) plus their position in the all-time leaderboard. Reuses the
// same sms_game_room_alltime_leaderboard RPC the full leaderboard route
// calls, rather than a second bespoke aggregate query, so the two views
// can never drift out of sync with each other.
export async function GET() {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const [{ data: leaderboard, error: leaderboardError }, { data: practiceRows, error: practiceError }] = await Promise.all([
    supabase.rpc('sms_game_room_alltime_leaderboard'),
    supabase
      .from('sms_game_players')
      .select('id, session:sms_game_sessions!inner(is_solo_practice)')
      .eq('student_id', student.id)
      .eq('completed', true)
      .eq('session.is_solo_practice', true),
  ])

  if (leaderboardError) {
    return NextResponse.json({ error: leaderboardError.message }, { status: 400 })
  }
  if (practiceError) {
    return NextResponse.json({ error: practiceError.message }, { status: 400 })
  }

  const rows = leaderboard ?? []
  const myIndex = rows.findIndex((r: { student_id: string }) => r.student_id === student.id)
  const mine = myIndex === -1 ? null : rows[myIndex]

  return NextResponse.json({
    totalPoints: mine?.total_points ?? 0,
    gamesPlayed: mine?.games_played ?? 0,
    rank: myIndex === -1 ? null : myIndex + 1,
    totalStudentsRanked: rows.length,
    practiceSessionsPlayed: (practiceRows ?? []).length,
  })
}
