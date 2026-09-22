import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { requireString } from '@/lib/validation'

// POST /api/gameroom-v2/question-sets/[id]/assign -- attaches a
// question set the caller OWNS to one of their own classes
// (class_id already exists on sms_gamev2_question_sets since 073).
// This is genuinely functional today (no play engine required for a
// set to be scoped to a class) -- it does NOT create anything under
// legacy GameRoom's sms_assignments, which is a different feature
// entirely for a different content model; conflating the two would
// break the isolation this whole rebuild is built on.
//
// Only the OWNER can assign a set (not merely "can read" -- unlike
// duplicate/preview, assigning changes the set's own class_id column,
// a real mutation of someone else's content would need to be owner-
// only). RLS ("gamev2_question_sets: teacher manage own") already
// enforces this; the explicit ownership check below just gives a
// clean 403 instead of a raw RLS-empty-update.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const classId = requireString(body.classId, 'Class', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  const { data: questionSet, error } = await supabase
    .from('sms_gamev2_question_sets')
    .update({ class_id: classId })
    .eq('id', params.id)
    .eq('created_by', profile.id)
    .select()
    .single()

  if (error || !questionSet) {
    return NextResponse.json({ error: error?.message || 'Question set not found, or you do not own it' }, { status: 404 })
  }

  await supabase.from('sms_gamev2_question_set_usage').insert([
    { question_set_id: params.id, profile_id: profile.id, action: 'ASSIGN' },
  ])

  return NextResponse.json({ questionSet })
}
