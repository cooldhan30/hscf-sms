import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireString, requireEnum } from '@/lib/validation'
import { sanitizeRichText } from '@/lib/sanitize'

const AUDIENCE_TYPES = ['school', 'teachers', 'parents', 'students', 'grade', 'class'] as const
const STATUSES = ['draft', 'published'] as const

// POST /api/admin/announcements
// Body: { title, body, audienceType, gradeLevel?, classIds?, status,
//          publishAt?, notifyEmail?, notifyPush? }
// Admin can use any audience type, unlike teachers who are scoped to
// their own classes/grade (enforced separately in the teacher route).
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const title = requireString(body.title, 'Title', errors)
  const rawText = requireString(body.body, 'Message', errors)
  const audienceType = requireEnum(body.audienceType, AUDIENCE_TYPES, 'Audience', errors)
  const status = requireEnum(body.status, STATUSES, 'Status', errors)
  const classIds: string[] = Array.isArray(body.classIds) ? body.classIds.filter(Boolean) : []
  const gradeLevel: string | null = typeof body.gradeLevel === 'string' && body.gradeLevel ? body.gradeLevel : null
  const publishAt: string | null = typeof body.publishAt === 'string' && body.publishAt ? body.publishAt : null
  const notifyEmail = Boolean(body.notifyEmail)
  const notifyPush = Boolean(body.notifyPush)

  if (audienceType === 'grade' && !gradeLevel) errors.push('Select a grade level')
  if (audienceType === 'class' && classIds.length === 0) errors.push('Select at least one class')

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const admin = createAdminClient()
  const text = sanitizeRichText(rawText)

  const { data: announcement, error: annError } = await admin
    .from('sms_announcements')
    .insert([
      {
        title,
        body: text,
        audience_type: audienceType,
        grade_level: audienceType === 'grade' ? gradeLevel : null,
        status,
        publish_at: status === 'published' ? publishAt : null,
        notify_email: notifyEmail,
        notify_push: notifyPush,
        created_by: guard.profile.id,
      },
    ])
    .select()
    .single()

  if (annError) {
    return NextResponse.json({ error: annError.message }, { status: 400 })
  }

  if (audienceType === 'class' && classIds.length > 0) {
    const { error: linkError } = await admin
      .from('sms_announcement_classes')
      .insert(classIds.map((classId) => ({ announcement_id: announcement.id, class_id: classId })))

    if (linkError) {
      return NextResponse.json(
        { error: `Announcement created, but targeting classes failed: ${linkError.message}` },
        { status: 400 }
      )
    }
  }

  // Queue notification requests. Nothing is actually sent -- there's no
  // email/push provider wired in yet -- a future worker would pick up
  // 'pending' rows once the announcement's publish_at has passed and
  // dispatch via a real provider (Resend/SendGrid/FCM/etc.), then update
  // status to 'sent'/'failed'.
  if (status === 'published' && (notifyEmail || notifyPush)) {
    const rows = []
    if (notifyEmail) rows.push({ announcement_id: announcement.id, channel: 'email' as const })
    if (notifyPush) rows.push({ announcement_id: announcement.id, channel: 'push' as const })
    await admin.from('sms_announcement_notifications').insert(rows)
  }

  return NextResponse.json({ announcement }, { status: 201 })
}
