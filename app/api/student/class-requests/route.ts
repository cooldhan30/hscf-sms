import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'
import { requireString } from '@/lib/validation'

// POST /api/student/class-requests -- request to join a class by its
// join code. The class's own teacher resolves this (see
// /api/teacher/classes/[id]/join-requests/[requestId]). Same
// resend-if-denied upsert pattern as the teacher-side route.
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
    .from('sms_class_join_requests')
    .select('status')
    .eq('class_id', cls.class_id)
    .eq('student_id', student.id)
    .maybeSingle()

  if (existing && existing.status !== 'denied') {
    return NextResponse.json(
      { error: existing.status === 'pending' ? 'A request is already pending for this class' : 'You are already enrolled in this class' },
      { status: 409 }
    )
  }

  const { data: classRequest, error } = await supabase
    .from('sms_class_join_requests')
    .upsert([{ class_id: cls.class_id, student_id: student.id, status: 'pending' }], {
      onConflict: 'class_id,student_id',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ classRequest, className: cls.class_name }, { status: 201 })
}
