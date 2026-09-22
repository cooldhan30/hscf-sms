import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'
import { normalizeJoinCode, deriveLiveNickname } from '@/lib/gameRoomV2/liveClassroom'

interface ResolvedLiveSession {
  live_session_id: string
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'ENDED'
  class_id: string
  engine_id: string
  question_set_id: string
  is_enrolled: boolean
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
// Reconnect is the SAME code path as a first join: if a participant row
// already exists for (liveSessionId, student.id), this returns it
// as-is (200) rather than erroring or duplicating -- a student whose
// tab crashed and reopens the page just re-enters the same code.
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

  if (resolved.status !== 'LOBBY') {
    return NextResponse.json({ error: 'This live session has already started or ended' }, { status: 409 })
  }

  const { data: existingParticipant } = await supabase
    .from('sms_gamev2_live_participants')
    .select('id')
    .eq('live_session_id', resolved.live_session_id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existingParticipant) {
    // Reconnect: mark presence fresh again and return the same session.
    await supabase
      .from('sms_gamev2_live_participants')
      .update({ connected: true, last_seen_at: new Date().toISOString() })
      .eq('id', existingParticipant.id)
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

  return NextResponse.json({ liveSessionId: resolved.live_session_id }, { status: 201 })
}
