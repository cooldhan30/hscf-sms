import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeRichText } from '@/lib/sanitize'

const VALID_STATUSES = ['draft', 'published', 'archived']

// PATCH /api/admin/announcements/[id]
// Used for both status transitions (publish a draft, archive, republish)
// and simple field edits. Body accepts any subset of:
// { title, body, status, publishAt, notifyEmail, notifyPush }
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if ('title' in body && typeof body.title === 'string') updates.title = body.title.trim()
  if ('body' in body && typeof body.body === 'string') updates.body = sanitizeRichText(body.body)
  if ('status' in body) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    if (body.status === 'archived') updates.archived_at = new Date().toISOString()
  }
  if ('publishAt' in body) {
    updates.publish_at = typeof body.publishAt === 'string' && body.publishAt ? body.publishAt : null
  }
  if ('notifyEmail' in body) updates.notify_email = Boolean(body.notifyEmail)
  if ('notifyPush' in body) updates.notify_push = Boolean(body.notifyPush)

  const { data, error } = await admin
    .from('sms_announcements')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Announcement not found' }, { status: 400 })
  }

  // If this transition just published it (and notifications are requested),
  // queue them the same way POST does.
  if (body.status === 'published' && (data.notify_email || data.notify_push)) {
    const rows = []
    if (data.notify_email) rows.push({ announcement_id: data.id, channel: 'email' as const })
    if (data.notify_push) rows.push({ announcement_id: data.id, channel: 'push' as const })
    if (rows.length > 0) await admin.from('sms_announcement_notifications').insert(rows)
  }

  return NextResponse.json({ announcement: data })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('sms_announcements').delete().eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
