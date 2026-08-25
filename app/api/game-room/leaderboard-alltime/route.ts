import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'

// GET /api/game-room/leaderboard-alltime -- student-only. The
// schoolwide/class "who's on top at year end" ranked list -- any
// authenticated student can see the competitive standings, same
// visibility model as a class leaderboard. Only teacher-hosted,
// completed sessions count (see sms_game_room_alltime_leaderboard in
// 057_game_room_student_identity.sql) -- solo practice never affects
// rank.
export async function GET() {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { data, error } = await supabase.rpc('sms_game_room_alltime_leaderboard')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ leaderboard: data ?? [] })
}
