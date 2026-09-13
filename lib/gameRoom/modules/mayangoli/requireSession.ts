import 'server-only'
import { requireTeacher } from '@/lib/require-teacher'
import { requireStudent } from '@/lib/require-student'
import type { createClient } from '@/lib/supabase/server'

export interface MayangoliSessionRow {
  id: string
  join_code: string
  host_teacher_id: string
  status: 'waiting' | 'active' | 'reveal' | 'ended'
  question_ids: string[]
  question_time_limit_seconds: number
  current_question_index: number
  current_question_started_at: string | null
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export interface MayangoliPlayerRow {
  id: string
  session_id: string
  student_id: string
  nickname: string
  score: number
  correct_count: number
  answered_count: number
  current_streak: number
  best_streak: number
  connected: boolean
  joined_at: string
}

// Host (teacher) guard -- RLS ("mayangoli_sessions: host manages own")
// is the real enforcement boundary; this just gives a clean 404/403
// instead of an RLS-filtered empty read.
export async function requireMayangoliHost(
  sessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; session: MayangoliSessionRow }
  | { ok: false; status: number; error: string }
> {
  if (typeof sessionId !== 'string' || !sessionId) {
    return { ok: false, status: 400, error: 'sessionId is required' }
  }

  const guard = await requireTeacher()
  if (!guard.ok) {
    return { ok: false, status: guard.status, error: guard.error }
  }
  const { supabase } = guard

  const { data: session } = await supabase.from('sms_mayangoli_sessions').select('*').eq('id', sessionId).single()

  if (!session) {
    return { ok: false, status: 404, error: 'Mayangoli session not found' }
  }

  return { ok: true, supabase, session: session as MayangoliSessionRow }
}

// Student (player) guard -- same idiom as requireGamePlayer.
export async function requireMayangoliPlayer(
  sessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; player: MayangoliPlayerRow; session: MayangoliSessionRow }
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

  const { data: session } = await supabase.from('sms_mayangoli_sessions').select('*').eq('id', sessionId).single()

  if (!session) {
    return { ok: false, status: 404, error: 'Mayangoli session not found' }
  }

  const { data: player } = await supabase
    .from('sms_mayangoli_players')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_id', student.id)
    .single()

  if (!player) {
    return { ok: false, status: 404, error: 'You have not joined this game' }
  }

  return { ok: true, supabase, player: player as MayangoliPlayerRow, session: session as MayangoliSessionRow }
}
