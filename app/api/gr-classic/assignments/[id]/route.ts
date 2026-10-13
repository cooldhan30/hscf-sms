import { NextResponse } from 'next/server'
import { dbErrorResponse, grcTeacherApi, readJson } from '@/lib/grClassic/server/auth'
import { isUuid } from '@/lib/grClassic/validateQuestion'

// PATCH /api/gr-classic/assignments/:id { dueAt?, status? }
// Extend (or change) the deadline, close or reopen. Teacher's own only.
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
  if (!Object.keys(changes).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  const { data, error } = await guard.supabase.from('sms_grc_assignments').update(changes).eq('id', params.id).select('id, due_at, status').maybeSingle()
  if (error) return dbErrorResponse(error, 'update assignment')
  if (!data) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })
  return NextResponse.json({ dueAt: data.due_at, status: data.status })
}
