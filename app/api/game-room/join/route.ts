import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'
import { shuffle } from '@/lib/gameRoom/shuffle'

// POST /api/game-room/join -- student-only (Clerk-authenticated, like
// every other student route). Body: { joinCode }. No nickname anymore --
// the student's real name comes from their own sms_students profile, so
// scores/history can be aggregated across sessions for the same actual
// person (an anonymous nickname couldn't reliably identify a returning
// student -- see supabase/migrations/057_game_room_student_identity.sql).
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const joinCode = requireString(body.joinCode, 'Game code', errors).toUpperCase()
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: resolved, error: resolveError } = await supabase
    .rpc('sms_resolve_game_session_by_join_code', { p_code: joinCode })
    .maybeSingle<{ session_id: string; status: string; game_type: string; question_ids: string[] }>()

  if (resolveError || !resolved) {
    return NextResponse.json({ error: 'Game code not found' }, { status: 404 })
  }

  // A student re-opening the join link (e.g. after a dropped connection)
  // should resume their existing row, not create a duplicate -- this is
  // also now the whole reconnection story, replacing the old
  // localStorage-bearer-token approach.
  const { data: existingPlayer } = await supabase
    .from('sms_game_players')
    .select('id')
    .eq('session_id', resolved.session_id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existingPlayer) {
    return NextResponse.json({ sessionId: resolved.session_id }, { status: 200 })
  }

  if (resolved.status !== 'waiting') {
    return NextResponse.json(
      { error: 'This game has already started or ended -- ask your teacher for a new code' },
      { status: 409 }
    )
  }

  const questionOrder = shuffle(resolved.question_ids)
  const nickname = `${student.first_name} ${student.last_name}`.trim()

  const { data: player, error: insertError } = await supabase
    .from('sms_game_players')
    .insert([
      {
        session_id: resolved.session_id,
        student_id: student.id,
        nickname,
        question_order: questionOrder,
      },
    ])
    .select()
    .single()

  if (insertError || !player) {
    return NextResponse.json({ error: insertError?.message || 'Failed to join game' }, { status: 400 })
  }

  return NextResponse.json({ sessionId: resolved.session_id }, { status: 201 })
}
