import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/attendance?classId=&date= -- roster + attendance for
// that class/date, across ANY teacher's class (no teacher_id restriction,
// unlike /api/teacher/attendance -- this is the admin's read-only
// cross-class view, using the service-role client since RLS on
// sms_attendance only grants teachers their own classes).
// GET /api/admin/attendance?classId=&month=YYYY-MM -- which dates in that
// month already have attendance recorded, same shape as the teacher route,
// so the same AttendanceCalendar component can shade them here too.
export async function GET(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const admin = createAdminClient()

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const date = searchParams.get('date')
  const month = searchParams.get('month')

  if (!classId || (!date && !month)) {
    return NextResponse.json({ error: 'classId and either date or month query params are required' }, { status: 400 })
  }

  if (month) {
    const monthStart = `${month}-01`
    const [year, monthNum] = month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`

    const { data: attendance } = await admin
      .from('sms_attendance')
      .select('date')
      .eq('class_id', classId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const markedDates = Array.from(new Set((attendance ?? []).map((a) => a.date)))
    return NextResponse.json({ markedDates })
  }

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    admin
      .from('sms_class_enrollments')
      .select('student:sms_students(*)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .returns<{ student: { id: string; first_name: string; last_name: string } }[]>(),
    admin
      .from('sms_attendance')
      .select('*, marked_by_profile:sms_profiles!marked_by(first_name, last_name)')
      .eq('class_id', classId)
      .eq('date', date),
  ])

  return NextResponse.json({
    roster: (enrollments ?? []).map((e) => e.student),
    attendance: attendance ?? [],
  })
}
