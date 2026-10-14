import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// POST /api/gr-classic/assignments/:id/grant { studentId }
// Gives one student one more attempt. Only the teacher who made the
// assignment; the student must be enrolled in a class it was given to.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  const body = await readJson(request)
  if (!isUuid(params.id) || !isUuid(body?.studentId)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { supabase } = guard
  const { data: own } = await supabase.from('sms_grc_assignments').select('owner_id').eq('id', params.id).maybeSingle()
  if (!own) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  if ((own as { owner_id: string }).owner_id !== guard.userId) return NextResponse.json({ error: 'Only the teacher who made this assignment can give extra attempts.' }, { status: 403 })
  const { data: links } = await supabase.from('sms_grc_assignment_classes').select('class_id').eq('assignment_id', params.id)
  const classIds = ((links ?? []) as { class_id: string }[]).map((l) => l.class_id)
  if (!classIds.length) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  const { data: enrolled } = await supabase.from('sms_class_enrollments').select('student_id').eq('student_id', body.studentId).in('class_id', classIds).eq('status', 'active').limit(1)
  if (!enrolled?.length) return NextResponse.json({ error: 'That student is not in this assignment.' }, { status: 400 })
  const { data: current } = await supabase.from('sms_grc_attempt_grants').select('extra').eq('assignment_id', params.id).eq('student_id', body.studentId).maybeSingle()
  const extra = ((current as { extra: number } | null)?.extra ?? 0) + 1
  if (extra > 20) return NextResponse.json({ error: 'That is the most extra attempts allowed.' }, { status: 400 })
  const { error } = await supabase.from('sms_grc_attempt_grants').upsert({ assignment_id: params.id, student_id: body.studentId, extra })
  if (error) return dbErrorResponse(error, 'grant attempt')
  return NextResponse.json({ extra })
}
