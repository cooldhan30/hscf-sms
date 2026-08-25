import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// GET /api/game-room/leaderboard?sessionId=... -- teacher-only. REST
// fallback / initial-load for the ranked player list; the live dashboard
// otherwise relies on a Supabase Realtime subscription (postgres_changes
// UPDATE on sms_game_players) for incremental updates after this first
// paint, mirroring lib/chat.ts's proven channel pattern.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const { data: players, error } = await supabase
    .from('sms_game_players')
    .select('*')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ players: players ?? [] })
}
