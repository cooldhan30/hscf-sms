import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireEnum } from '@/lib/validation'

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'holiday', 'online'] as const

// GET /api/teacher/attendance?classId=&date= -- roster + any existing
// attendance for that class/date, so the form can load in "edit" mode.
// GET /api/teacher/attendance?classId=&month=YYYY-MM -- instead returns
// which dates in that month already have attendance recorded, so the
// calendar can shade them without loading a full roster for every day.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const date = searchParams.get('date')
  const month = searchParams.get('month')

  if (!classId || (!date && !month)) {
    return NextResponse.json({ error: 'classId and either date or month query params are required' }, { status: 400 })
  }

  // A class can be co-taught (migration 036) -- teacher_id on sms_classes
  // is only the lead/primary teacher, so checking it directly here would
  // wrongly reject a co-teacher RLS itself already allows. This RPC is
  // the same helper "attendance: teacher manage own class" routes
  // through, so this check can never drift from what RLS actually permits.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  if (month) {
    const monthStart = `${month}-01`
    const [year, monthNum] = month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, '0')}`

    const { data: attendance } = await supabase
      .from('sms_attendance')
      .select('date')
      .eq('class_id', classId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const markedDates = Array.from(new Set((attendance ?? []).map((a) => a.date)))
    return NextResponse.json({ markedDates })
  }

  const [{ data: enrollments }, { data: attendance }] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('student:sms_students(*)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .returns<{ student: { id: string; first_name: string; last_name: string } }[]>(),
    supabase.from('sms_attendance').select('*').eq('class_id', classId).eq('date', date),
  ])

  return NextResponse.json({
    roster: (enrollments ?? []).map((e) => e.student),
    attendance: attendance ?? [],
  })
}

// POST /api/teacher/attendance -- bulk submit/edit attendance for a
// class + date. Body: { classId, date, records: [{ studentId, status, notes }] }
export async function POST(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, profile } = guard

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { classId, date, records } = body
  if (!classId || !date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'classId, date, and a non-empty records array are required' }, { status: 400 })
  }

  // A class can be co-taught (migration 036) -- teacher_id on sms_classes
  // is only the lead/primary teacher, so checking it directly here would
  // wrongly reject a co-teacher RLS itself already allows. This RPC is
  // the same helper "attendance: teacher manage own class" routes
  // through, so this check can never drift from what RLS actually permits.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  const errors: string[] = []
  const rows = records.map((r: { studentId?: string; status?: string; notes?: string }, i: number) => {
    if (!r.studentId) errors.push(`records[${i}].studentId is required`)
    const status = requireEnum(r.status, ATTENDANCE_STATUSES, `records[${i}].status`, errors)
    return {
      class_id: classId,
      student_id: r.studentId,
      date,
      status,
      notes: r.notes?.trim() || null,
      marked_by: profile.id,
    }
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { error } = await supabase
    .from('sms_attendance')
    .upsert(rows, { onConflict: 'class_id,student_id,date' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
