import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, requireEnum } from '@/lib/validation'
import { sanitizeRichText } from '@/lib/sanitize'

const TEACHER_AUDIENCE_TYPES = ['grade', 'class'] as const
const STATUSES = ['draft', 'published'] as const

// POST /api/teacher/announcements
// Body: { title, body, audienceType: 'grade'|'class', gradeLevel?, classIds?,
//          status, publishAt?, notifyEmail?, notifyPush? }
// Teachers are scoped to their own classes/grade only -- 'school',
// 'teachers', 'parents', 'students' audiences are admin-only, enforced
// here (only 'grade'/'class' are accepted) as well as by RLS.
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, teacher, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const errors: string[] = []
  const title = requireString(body.title, 'Title', errors)
  const rawText = requireString(body.body, 'Message', errors)
  const audienceType = requireEnum(body.audienceType, TEACHER_AUDIENCE_TYPES, 'Audience', errors)
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

  // Confirm every targeted class actually belongs to this teacher.
  if (audienceType === 'class') {
    const { data: ownedClasses } = await supabase
      .from('sms_classes')
      .select('id')
      .eq('teacher_id', teacher.id)
      .in('id', classIds)

    if (!ownedClasses || ownedClasses.length !== classIds.length) {
      return NextResponse.json({ error: 'One or more selected classes are not assigned to you' }, { status: 403 })
    }
  }

  if (audienceType === 'grade') {
    const { data: gradeClasses } = await supabase
      .from('sms_classes')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('grade_level', gradeLevel)
      .limit(1)

    if (!gradeClasses || gradeClasses.length === 0) {
      return NextResponse.json({ error: 'You have no classes at that grade level' }, { status: 403 })
    }
  }

  const text = sanitizeRichText(rawText)

  const { data: announcement, error: annError } = await supabase
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
        created_by: profile.id,
      },
    ])
    .select()
    .single()

  if (annError) {
    return NextResponse.json({ error: annError.message }, { status: 400 })
  }

  if (audienceType === 'class' && classIds.length > 0) {
    const { error: linkError } = await supabase
      .from('sms_announcement_classes')
      .insert(classIds.map((classId) => ({ announcement_id: announcement.id, class_id: classId })))

    if (linkError) {
      return NextResponse.json(
        { error: `Announcement created, but targeting classes failed: ${linkError.message}` },
        { status: 400 }
      )
    }
  }

  if (status === 'published' && (notifyEmail || notifyPush)) {
    const rows = []
    if (notifyEmail) rows.push({ announcement_id: announcement.id, channel: 'email' as const })
    if (notifyPush) rows.push({ announcement_id: announcement.id, channel: 'push' as const })
    await supabase.from('sms_announcement_notifications').insert(rows)
  }

  return NextResponse.json({ announcement }, { status: 201 })
}
