import 'server-only'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import type { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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
// for a pattern this close.
//
// READS vs WRITES (migration 083): students have SELECT-only RLS on
// sms_gamev2_sessions/answers/learning_events, so the session lookup
// below runs through the caller's own RLS-scoped `supabase` client --
// that lookup IS the authorization ("this session belongs to me"). Every
// WRITE a gameplay route makes goes through `admin` (service role,
// server-only), and must always be scoped with
// `.eq('id', session.id).eq('student_id', studentId)` -- the server
// computes every written value; the browser can no longer write these
// rows at all.
export async function requireGameV2Session(
  sessionId: unknown
): Promise<
  | {
      ok: true
      supabase: ReturnType<typeof createClient>
      admin: ReturnType<typeof createAdminClient>
      studentId: string
      session: GameV2SessionRow
    }
  | { ok: false; status: number; error: string }
> {
  if (typeof sessionId !== 'string' || !sessionId) {
    return { ok: false, status: 400, error: 'sessionId is required' }
  }

  const guard = await requireGameV2Student()
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

  return { ok: true, supabase, admin: createAdminClient(), studentId: student.id, session: session as GameV2SessionRow }
}

// True when this session is a Live Classroom participant's bridged
// session (sms_gamev2_live_participants.session_id) rather than solo
// play. RLS ("gamev2_live_participants: student read own") lets the
// student's own client see only their own participant rows, which is
// exactly the row this looks for.
export async function isLiveBridgedSession(supabase: ReturnType<typeof createClient>, sessionId: string): Promise<boolean> {
  const { data } = await supabase.from('sms_gamev2_live_participants').select('id').eq('session_id', sessionId).limit(1)
  return (data ?? []).length > 0
}
