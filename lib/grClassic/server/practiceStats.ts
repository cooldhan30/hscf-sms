import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameType, PracticeStats } from '../types'

// How a teacher's students have practised one of the teacher's games.
// Through the teacher's own RLS-scoped client: practice progress is
// readable only for the teacher's own games (migration 097), and student
// names only for students they teach.

export async function practiceStats(supabase: SupabaseClient, gameId: string): Promise<PracticeStats | null> {
  const { data: game } = await supabase.from('sms_grc_games').select('id, title, game_type, practice').eq('id', gameId).is('archived_at', null).maybeSingle()
  if (!game) return null
  const g = game as { id: string; title: string; game_type: GameType; practice: boolean }
  const { data: progress } = await supabase.from('sms_grc_practice_progress').select('student_id, plays, best_percent, last_percent, last_played_at').eq('game_id', gameId).order('last_played_at', { ascending: false })
  const p = (progress ?? []) as { student_id: string; plays: number; best_percent: number; last_percent: number; last_played_at: string }[]
  const { data: students } = p.length ? await supabase.from('sms_students').select('id, first_name, last_name').in('id', p.map((r) => r.student_id)) : { data: [] }
  const names = new Map(((students ?? []) as { id: string; first_name: string; last_name: string }[]).map((s) => [s.id, `${s.first_name} ${s.last_name}`.trim()]))
  return {
    gameId: g.id,
    title: g.title,
    type: g.game_type,
    practice: g.practice,
    rows: p.map((r) => ({ studentId: r.student_id, name: names.get(r.student_id) ?? 'A former student', plays: r.plays, bestPercent: r.best_percent, lastPercent: r.last_percent, lastPlayedAt: r.last_played_at })),
  }
}
