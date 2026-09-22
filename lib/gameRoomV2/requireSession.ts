import 'server-only'
import { requireStudent } from '@/lib/require-student'
import type { createClient } from '@/lib/supabase/server'
import type { GameSessionStatus } from './domain'

export interface GameV2SessionRow {
  id: string
  question_set_id: string
  engine_id: string
  student_id: string
  status: GameSessionStatus
  question_order: string[]
  current_index: number
  current_question_started_at: string | null
  question_time_limit_seconds: number
  lives: number
  max_lives: number
  current_streak: number
  best_streak: number
  score: number
  correct_count: number
  answered_count: number
  xp_earned: number
  coins_earned: number
  pause_duration_seconds: number
  paused_at: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  abandoned_at: string | null
  rewards_finalized_at: string | null
}

// Every gameplay route (start/state/answer/pause/resume/complete/
// abandon) authenticates through this, mirroring legacy GameRoom's
// requireGamePlayer() pattern (lib/gameRoom/requirePlayer.ts) --
// wrap requireStudent(), then load/validate the session row -- but
// reimplemented from scratch rather than imported, per V2's isolation
// rule (see README.md): no V2 file imports from lib/gameRoom/*, even
// for a pattern this close. RLS ("gamev2_sessions: student manage
// own") is the real enforcement boundary; this guard just gives a
// clean 404/403 instead of a raw RLS-empty-result.
export async function requireGameV2Session(
  sessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; studentId: string; session: GameV2SessionRow }
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
    .from('sms_gamev2_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('student_id', student.id)
    .single()

  if (!session) {
    return { ok: false, status: 404, error: 'Game session not found' }
  }

  return { ok: true, supabase, studentId: student.id, session: session as GameV2SessionRow }
}
