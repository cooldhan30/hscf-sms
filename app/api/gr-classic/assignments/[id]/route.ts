import { NextResponse } from 'next/server'
import { validateSettingsPatch } from '@/lib/grClassic/assignments'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { ASSIGNMENT_COLUMNS, toAssignment, type AssignmentRow } from '@/lib/grClassic/server/assignmentRows'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// PATCH /api/gr-classic/assignments/:id { dueAt?, status?, settings? }
// Change the deadline, close or reopen, or change settings. Only the
// teacher who made the assignment (RLS "manage own"); co-teachers who can
// see the results get "not found" here. Returns the updated assignment.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await grcTeacherApi()
  if (!guard.ok) return guard.response
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  const body = await readJson(request)
  const changes: Record<string, unknown> = {}
  if (body?.dueAt !== undefined) {
    const due = typeof body.dueAt === 'string' ? new Date(body.dueAt) : null
    if (!due || Number.isNaN(due.getTime())) return NextResponse.json({ error: 'Pick a valid due date.' }, { status: 400 })
    changes.due_at = due.toISOString()
  }
  if (body?.status !== undefined) {
    if (body.status !== 'open' && body.status !== 'closed') return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
    changes.status = body.status
  }
  if (body?.settings !== undefined) {
    const s = body.settings && typeof body.settings === 'object' ? validateSettingsPatch(body.settings as Record<string, unknown>) : { ok: false as const, errors: ['Invalid settings.'] }
    if (!s.ok) return NextResponse.json({ error: s.errors.join(' ') }, { status: 400 })
    Object.assign(changes, s.columns)
  }
  if (!Object.keys(changes).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  const { data, error } = await guard.supabase.from('sms_grc_assignments').update(changes).eq('id', params.id).eq('owner_id', guard.userId).select(ASSIGNMENT_COLUMNS).maybeSingle()
  if (error) return dbErrorResponse(error, 'update assignment')
  if (!data) return NextResponse.json({ error: 'Only the teacher who made this assignment can change it.' }, { status: 404 })
  const a = data as AssignmentRow
  return NextResponse.json({ dueAt: a.due_at, status: a.status, settings: toAssignment(a, []).settings })
}
