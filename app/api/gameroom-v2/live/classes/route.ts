import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/gameroom-v2/live/classes -- the classes a teacher can host a
// live session for. Uses the SAME source of truth the host route's
// authorization uses (sms_teacher_owns_class() -> sms_class_teachers,
// so co-teachers count), plus the class's primary teacher_id. The old
// version listed only sms_classes.teacher_id, so a co-teacher never saw
// classes the server would have let them host (and could never start
// a session for them). The admin client is scoped to the caller's own,
// server-verified teacher id and returns only id/name/grade.
export async function GET() {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, teacher, isAdmin } = guard

  if (isAdmin) {
    const { data } = await supabase.from('sms_classes').select('id, name, grade_level').order('name')
    return NextResponse.json({ classes: data ?? [] })
  }
  if (!teacher) return NextResponse.json({ classes: [] })

  const admin = createAdminClient()
  const [{ data: primary }, { data: assigned }] = await Promise.all([
    admin.from('sms_classes').select('id').eq('teacher_id', teacher.id),
    admin.from('sms_class_teachers').select('class_id').eq('teacher_id', teacher.id),
  ])
  const ids = Array.from(new Set([...(primary ?? []).map((c) => c.id as string), ...(assigned ?? []).map((c) => c.class_id as string)]))
  if (ids.length === 0) return NextResponse.json({ classes: [] })
  const { data: classes } = await admin.from('sms_classes').select('id, name, grade_level').in('id', ids).order('name')
  return NextResponse.json({ classes: classes ?? [] })
}
