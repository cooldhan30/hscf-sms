import { NextResponse } from 'next/server'
import { requireParent } from '@/lib/require-parent'
import { requireEmail } from '@/lib/validation'

// POST /api/parent/link-requests -- request to be linked to a child by
// their account email. If a previous request to the same student was
// denied, this flips that same row back to pending (RLS: "parent_link_
// requests: parent resend own denied" only allows a denied -> pending
// transition) instead of erroring on the unique(parent_id, student_id)
// constraint.
export async function POST(request: Request) {
  const guard = await requireParent()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, parent } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const email = requireEmail(body.studentEmail, 'Student email', errors)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: matches } = await supabase.rpc('sms_find_student_by_email', { p_email: email })
  const student = matches?.[0]

  if (!student) {
    return NextResponse.json({ error: 'No student account found with that email' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('sms_parent_link_requests')
    .select('status')
    .eq('parent_id', parent.id)
    .eq('student_id', student.student_id)
    .maybeSingle()

  if (existing && existing.status !== 'denied') {
    return NextResponse.json(
      { error: existing.status === 'pending' ? 'A request is already pending for this student' : 'You are already linked to this student' },
      { status: 409 }
    )
  }

  const { data: linkRequest, error } = await supabase
    .from('sms_parent_link_requests')
    .upsert([{ parent_id: parent.id, student_id: student.student_id, status: 'pending' }], {
      onConflict: 'parent_id,student_id',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ linkRequest }, { status: 201 })
}
