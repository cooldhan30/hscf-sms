import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString } from '@/lib/validation'

// POST /api/teacher/class-requests -- request to be attached to a class
// by its join code. Admin resolves this (see
// /api/admin/classes/[id]/teacher-requests/[requestId]) -- a class
// already having a teacher does not block the request, it's still
// created as pending and admin decides. If a previous request to the
// same class was denied, this flips that row back to pending instead of
// erroring on the unique(class_id, teacher_id) constraint.
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, teacher } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const code = requireString(body.code, 'Class code', errors).toUpperCase()
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: matches } = await supabase.rpc('sms_resolve_class_by_join_code', { p_code: code })
  const cls = matches?.[0]
  if (!cls) {
    return NextResponse.json({ error: 'Invalid class code' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('sms_class_teacher_requests')
    .select('status')
    .eq('class_id', cls.class_id)
    .eq('teacher_id', teacher.id)
    .maybeSingle()

  if (existing && existing.status !== 'denied') {
    return NextResponse.json(
      { error: existing.status === 'pending' ? 'A request is already pending for this class' : 'You are already attached to this class' },
      { status: 409 }
    )
  }

  const { data: classRequest, error } = await supabase
    .from('sms_class_teacher_requests')
    .upsert([{ class_id: cls.class_id, teacher_id: teacher.id, status: 'pending' }], {
      onConflict: 'class_id,teacher_id',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ classRequest, className: cls.class_name }, { status: 201 })
}
