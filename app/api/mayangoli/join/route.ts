import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'

// POST /api/mayangoli/join -- student-only. Body: { joinCode }. Same
// "student's real identity, not an anonymous nickname" contract as the
// existing engine's join route (supabase/migrations/057_game_room_
// student_identity.sql) -- score/history can be attributed to a real
// student record.
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
    .rpc('sms_resolve_mayangoli_session_by_join_code', { p_code: joinCode })
    .maybeSingle<{ session_id: string; status: string }>()

  if (resolveError || !resolved) {
    return NextResponse.json({ error: 'Game code not found' }, { status: 404 })
  }

  const { data: existingPlayer } = await supabase
    .from('sms_mayangoli_players')
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

  const nickname = `${student.first_name} ${student.last_name}`.trim()

  const { data: player, error: insertError } = await supabase
    .from('sms_mayangoli_players')
    .insert([{ session_id: resolved.session_id, student_id: student.id, nickname }])
    .select()
    .single()

  if (insertError || !player) {
    return NextResponse.json({ error: insertError?.message || 'Failed to join game' }, { status: 400 })
  }

  return NextResponse.json({ sessionId: resolved.session_id }, { status: 201 })
}
