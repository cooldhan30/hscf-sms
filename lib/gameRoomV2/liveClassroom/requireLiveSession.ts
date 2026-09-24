import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface LiveSessionRow {
  id: string
  join_code: string
  host_teacher_id: string
  class_id: string
  question_set_id: string
  engine_id: string
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  question_time_limit_seconds: number
  question_count: number | null
  race_difficulty: 'easy' | 'normal' | 'hard'
  boss_id: 'suran' | 'kotravai-guardian' | 'naga-serpent' | null
  boss_difficulty: 'easy' | 'normal' | 'hard'
  question_order: string[]
  paused_at: string | null
  pause_duration_seconds: number
  created_at: string
  started_at: string | null
  ended_at: string | null
}

// Every HOST route (start/pause/resume/end, the teacher's own lobby
// view) authenticates through this -- mirrors requireGameV2Session's
// "wrap the role guard, then load/validate the row, scoped to the
// caller" shape. RLS ("gamev2_live_sessions: host teacher read own")
// is the real enforcement boundary for the lookup; this guard just
// gives a clean 404 instead of a raw RLS-empty-result. Since migration
// 083 the host can no longer UPDATE the row directly -- every lifecycle
// change goes through the ownership-checked SECURITY DEFINER RPCs.
export async function requireLiveSessionHost(
  liveSessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; teacherId: string; liveSession: LiveSessionRow }
  | { ok: false; status: number; error: string }
> {
  if (typeof liveSessionId !== 'string' || !liveSessionId) {
    return { ok: false, status: 400, error: 'liveSessionId is required' }
  }

  const guard = await requireGameV2Teacher()
  if (!guard.ok) {
    return { ok: false, status: guard.status, error: guard.error }
  }
  const { supabase, teacher, isAdmin } = guard

  if (!teacher && !isAdmin) {
    return { ok: false, status: 403, error: 'No teacher record found for this account' }
  }

  const { data: liveSession } = await supabase.from('sms_gamev2_live_sessions').select('*').eq('id', liveSessionId).single()

  if (!liveSession) {
    return { ok: false, status: 404, error: 'Live session not found' }
  }

  return { ok: true, supabase, teacherId: liveSession.host_teacher_id, liveSession: liveSession as LiveSessionRow }
}

// Every PARTICIPANT route (heartbeat, leave, the student's own lobby
// view) authenticates through this -- requires the caller to already
// HAVE a sms_gamev2_live_participants row for this live session (i.e.
// they've already joined via /join, which is the only route that
// creates that row). RLS ("gamev2_live_participants: student read
// own") scopes the participant lookup to the caller's own row. Students
// can no longer write participant rows at all (migration 083) -- the
// heartbeat/leave routes write through `admin`, always scoped to the
// participant id this guard resolved for the caller.
export async function requireLiveSessionParticipant(
  liveSessionId: unknown
): Promise<
  | {
      ok: true
      supabase: ReturnType<typeof createClient>
      admin: ReturnType<typeof createAdminClient>
      studentId: string
      liveSession: LiveSessionRow
      participant: { id: string; connected: boolean; last_seen_at: string; session_id: string | null }
    }
  | { ok: false; status: number; error: string }
> {
  if (typeof liveSessionId !== 'string' || !liveSessionId) {
    return { ok: false, status: 400, error: 'liveSessionId is required' }
  }

  const guard = await requireGameV2Student()
  if (!guard.ok) {
    return { ok: false, status: guard.status, error: guard.error }
  }
  const { supabase, student } = guard

  const { data: liveSession } = await supabase.from('sms_gamev2_live_sessions').select('*').eq('id', liveSessionId).maybeSingle()
  if (!liveSession) {
    return { ok: false, status: 404, error: 'Live session not found' }
  }

  const { data: participant } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id, connected, last_seen_at, session_id')
    .eq('live_session_id', liveSessionId)
    .eq('student_id', student.id)
    .maybeSingle()

  if (!participant) {
    return { ok: false, status: 403, error: 'You have not joined this live session' }
  }

  return { ok: true, supabase, admin: createAdminClient(), studentId: student.id, liveSession: liveSession as LiveSessionRow, participant }
}

// A route BOTH the host teacher AND every joined participant read
// (currently only the live race view, which every racer -- and the
// teacher watching -- needs to see simultaneously) authenticates
// through this instead of picking one of the two guards above. Tries
// the teacher identity first (an admin/teacher account never also has
// a student record in this system), falling back to the student
// identity -- the ACTUAL authorization for "is this caller allowed to
// see this specific live session's race data" still happens inside
// the SECURITY DEFINER RPC itself (sms_gamev2_get_live_race_state,
// migration 081), which independently re-checks host-or-participant
// membership; this guard's job is only "is the caller signed in as
// SOME GameRoom V2 role at all," giving a clean 401/403 instead of a
// raw RPC exception reaching the client.
export async function requireLiveSessionAny(
  liveSessionId: unknown
): Promise<
  | { ok: true; supabase: ReturnType<typeof createClient>; liveSession: LiveSessionRow }
  | { ok: false; status: number; error: string }
> {
  if (typeof liveSessionId !== 'string' || !liveSessionId) {
    return { ok: false, status: 400, error: 'liveSessionId is required' }
  }

  const { userId } = await auth()
  if (!userId) {
    return { ok: false, status: 401, error: 'Not authenticated' }
  }

  const hostGuard = await requireLiveSessionHost(liveSessionId)
  if (hostGuard.ok) {
    return { ok: true, supabase: hostGuard.supabase, liveSession: hostGuard.liveSession }
  }

  const participantGuard = await requireLiveSessionParticipant(liveSessionId)
  if (participantGuard.ok) {
    return { ok: true, supabase: participantGuard.supabase, liveSession: participantGuard.liveSession }
  }

  return { ok: false, status: 403, error: 'You are not part of this live session' }
}
