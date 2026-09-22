import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'

// GET /api/gameroom-v2/live/classes -- the teacher's own classes, for
// the "Host Live" flow's class picker (a live session's class_id is
// what every joining student's enrollment gets checked against). A
// small, V2-scoped route rather than reusing any legacy `sms_classes`
// listing endpoint, since none exists as a plain GET today and this
// keeps Live Classroom's own API surface self-contained.
export async function GET() {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, teacher, isAdmin } = guard

  if (!teacher && !isAdmin) {
    return NextResponse.json({ classes: [] })
  }

  const query = supabase.from('sms_classes').select('id, name, grade_level')
  const { data: classes } = isAdmin ? await query.order('name') : await query.eq('teacher_id', teacher!.id).order('name')

  return NextResponse.json({ classes: classes ?? [] })
}
