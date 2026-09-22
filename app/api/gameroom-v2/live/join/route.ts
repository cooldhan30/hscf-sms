import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'
import { normalizeJoinCode, deriveLiveNickname } from '@/lib/gameRoomV2/liveClassroom'
import { canJoinByCode, requiresLateJoinBridge, isLiveSessionStale } from '@/lib/gameRoomV2/liveClassroom/lifecycle'

interface ResolvedLiveSession {
  live_session_id: string
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  class_id: string
  engine_id: string
  question_set_id: string
  is_enrolled: boolean
  created_at: string
}

// POST /api/gameroom-v2/live/join -- the student flow's "Enter join
// code -> Enter authenticated session" step. Body: { joinCode }.
// Resolves the code via the SECURITY DEFINER RPC (which also checks
// class enrollment -- the actual "prevent students from joining
// unauthorized sessions" enforcement, since a student's own client has
// no RLS read access to sms_gamev2_live_sessions before joining, and
// the RPC itself refuses to reveal ANYTHING beyond is_enrolled=false
// for a code that resolves to a class the student isn't in).
//
// A join code works at any status except ENDED -- LOBBY is the normal
// case, but ACTIVE/PAUSED are both accepted too (a late joiner, or a
// student who reconnects after the host already started). See
// migration 080's sms_gamev2_join_active_live_session: once the code
// resolves to a live, ongoing session, this route bridges the student
// into their own sms_gamev2_sessions row immediately using the
// session's already-fixed question_order, rather than waiting for a
// start event that already happened.
//
// Reconnect is the SAME code path as a first join: if a participant row
// already exists for (liveSessionId, student.id), this returns it
// as-is (200) rather than erroring or duplicating -- a student whose
// tab crashed and reopens the page just re-enters the same code. This
// also covers the "duplicate connection" case (the same student opening
// a second tab with the same code): the UNIQUE (live_session_id,
// student_id) constraint on sms_gamev2_live_participants means a second
// tab's /join just re-marks the same participant row connected, it
// never creates a second identity in the roster.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const joinCode = requireString(body.joinCode, 'Join code', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: resolved, error: resolveError } = (await supabase
    .rpc('sms_gamev2_resolve_live_session_by_join_code', {
      p_join_code: normalizeJoinCode(joinCode),
      p_student_id: student.id,
    })
    .maybeSingle()) as { data: ResolvedLiveSession | null; error: { message: string } | null }

  if (resolveError) {
    return NextResponse.json({ error: resolveError.message }, { status: 400 })
  }
  // A code that matches nothing and a code that matches a session the
  // student isn't enrolled for return the SAME generic error -- never
  // distinguishing "wrong code" from "you're not in that class",
  // which would otherwise leak that a valid code exists for a class the
  // student has no business knowing about.
  if (!resolved || !resolved.live_session_id || !resolved.is_enrolled) {
    return NextResponse.json({ error: 'Invalid join code' }, { status: 404 })
  }

  if (!canJoinByCode(resolved.status)) {
    return NextResponse.json({ error: 'This live session has already ended' }, { status: 409 })
  }

  // STALE ROOM: the host started this room hours ago and never
  // returned (closed the tab mid-LOBBY, or an ACTIVE session whose
  // host client crashed) -- refuse the join with a clear message
  // rather than seating a student in a lobby/game that will never
  // progress. See lifecycle.ts's isLiveSessionStale header comment for
  // why this is a lazy, read-time check rather than a background sweep.
  if (isLiveSessionStale(resolved.status, resolved.created_at)) {
    return NextResponse.json({ error: 'This live session has gone stale -- ask your teacher to host a new one' }, { status: 410 })
  }

  const { data: existingParticipant } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id')
    .eq('live_session_id', resolved.live_session_id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existingParticipant) {
    // Reconnect: mark presence fresh again and return the same session.
    // If the live session is already ACTIVE/PAUSED and this
    // participant somehow never got bridged to their own
    // sms_gamev2_sessions row (their first /join raced the host's
    // Start, or they're a genuine late joiner reconnecting), bridge
    // them now via the same RPC a fresh late join uses below --
    // idempotent, so a normal reconnect that's already bridged is a
    // no-op read.
    await supabase
      .from('sms_gamev2_live_participants')
      .update({ connected: true, last_seen_at: new Date().toISOString() })
      .eq('id', existingParticipant.id)
    if (requiresLateJoinBridge(resolved.status)) {
      await supabase.rpc('sms_gamev2_join_active_live_session', {
        p_live_session_id: resolved.live_session_id,
        p_student_id: student.id,
      })
    }
    return NextResponse.json({ liveSessionId: resolved.live_session_id })
  }

  const nickname = deriveLiveNickname(profile.first_name, profile.last_name)

  const { error: insertError } = await supabase.from('sms_gamev2_live_participants').insert([
    {
      live_session_id: resolved.live_session_id,
      student_id: student.id,
      nickname,
    },
  ])

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  // LATE JOIN: the live session already started (or is paused) before
  // this student's first join -- bridge them into their own
  // sms_gamev2_sessions row immediately using the RPC from migration
  // 080, sharing the exact question_order every other participant
  // already got. A student joining while still LOBBY skips this --
  // their bridge row is created later, all at once with everyone
  // else's, by sms_gamev2_start_live_session when the host clicks
  // Start.
  if (requiresLateJoinBridge(resolved.status)) {
    const { error: bridgeError } = await supabase.rpc('sms_gamev2_join_active_live_session', {
      p_live_session_id: resolved.live_session_id,
      p_student_id: student.id,
    })
    if (bridgeError) {
      return NextResponse.json({ error: bridgeError.message }, { status: 400 })
    }
  }

  return NextResponse.json({ liveSessionId: resolved.live_session_id }, { status: 201 })
}
