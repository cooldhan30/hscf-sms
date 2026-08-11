import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

const VALID_STATUSES = ['draft', 'published', 'archived']

// PATCH /api/teacher/announcements/[id] -- status transitions (publish a
// draft, archive). RLS ("announcements: creator manage own") enforces a
// teacher can only touch announcements they themselves created.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if ('status' in body) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === 'archived') updates.archived_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('sms_announcements')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Announcement not found or not yours' }, { status: 400 })
  }

  if (body.status === 'published' && (data.notify_email || data.notify_push)) {
    const rows = []
    if (data.notify_email) rows.push({ announcement_id: data.id, channel: 'email' as const })
    if (data.notify_push) rows.push({ announcement_id: data.id, channel: 'push' as const })
    if (rows.length > 0) await supabase.from('sms_announcement_notifications').insert(rows)
  }

  return NextResponse.json({ announcement: data })
}

// DELETE /api/teacher/announcements/[id]
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { error } = await supabase.from('sms_announcements').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
