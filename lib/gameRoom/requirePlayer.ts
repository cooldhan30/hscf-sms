import 'server-only'
import { requireStudent } from '@/lib/require-student'
import type { createClient } from '@/lib/supabase/server'

export interface GamePlayerRow {
  id: string
  session_id: string
  student_id: string | null
  nickname: string
  question_order: string[]
  current_index: number
  current_question_started_at: string
  score: number
  correct_count: number
  answered_count: number
  completed: boolean
  connected: boolean
  joined_at: string
  completed_at: string | null
}

export interface GameSessionRow {
  id: string
  join_code: string
  host_teacher_id: string | null
  host_student_id: string | null
  is_solo_practice: boolean
  game_type: string
  status: 'waiting' | 'active' | 'paused' | 'ended'
  quiz_mode: string
  category_filter: string | null
  question_count: number
  question_time_limit_seconds: number
  question_ids: string[]
  paused_at: string | null
  pause_duration_seconds: number
  created_at: string
  started_at: string | null
  ended_at: string | null
}

// Every student-facing Game Room route (join/state/answer/practice) now
// authenticates via the same Clerk-backed requireStudent() guard every
// other student feature uses, operating on the student's own RLS-scoped
// client -- RLS ("game_players: student manage own" /
// "game_answers: student manage own", 057_game_room_student_identity.sql)
// is the real enforcement boundary, replacing the earlier anonymous
// bearer-token + service-role admin-client model. sessionId is looked up
// from the request itself (route param or body), not derived from a
// token, since the student's own Clerk session IS their identity now.
export async function requireGamePlayer(
  sessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; player: GamePlayerRow; session: GameSessionRow }
  | { ok: false; status: number; error: string }
> {
  if (typeof sessionId !== 'string' || !sessionId) {
    return { ok: false, status: 400, error: 'sessionId is required' }
  }

  const guard = await requireStudent()
  if (!guard.ok) {
    return { ok: false, status: guard.status, error: guard.error }
  }
  const { supabase, student } = guard

  const { data: session } = await supabase
    .from('sms_game_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return { ok: false, status: 404, error: 'Game session not found' }
  }

  const { data: player } = await supabase
    .from('sms_game_players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_id', student.id)
    .single()

  if (!player) {
    return { ok: false, status: 404, error: 'You have not joined this game' }
  }

  return { ok: true, supabase, player: player as GamePlayerRow, session: session as GameSessionRow }
}
