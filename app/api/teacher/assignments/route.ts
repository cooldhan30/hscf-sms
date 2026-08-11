import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { requireString, optionalString } from '@/lib/validation'

// POST /api/teacher/assignments -- create an assignment for one of the
// teacher's own classes. RLS ("assignments: teacher manage own class")
// is the real enforcement; the explicit class-ownership check here just
// gives a clean 403 instead of a raw Postgres RLS error.
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
  const classId = requireString(body.classId, 'Class', errors)
  const title = requireString(body.title, 'Title', errors)
  const description = optionalString(body.description)
  const dueDate = optionalString(body.dueDate)
  const maxScore = Number(body.maxScore)
  if (!body.maxScore || Number.isNaN(maxScore) || maxScore <= 0) {
    errors.push('Max score must be a positive number')
  }
  const pointsDeductionPerDay = body.pointsDeductionPerDay === undefined || body.pointsDeductionPerDay === ''
    ? 0
    : Number(body.pointsDeductionPerDay)
  if (Number.isNaN(pointsDeductionPerDay) || pointsDeductionPerDay < 0) {
    errors.push('Late penalty must be zero or a positive number')
  }
  const published = Boolean(body.published)
  const imageUrl = optionalString(body.imageUrl)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const { data: cls } = await supabase
    .from('sms_classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacher.id)
    .single()

  if (!cls) {
    return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 403 })
  }

  const { data: assignment, error } = await supabase
    .from('sms_assignments')
    .insert([
      {
        class_id: classId,
        title,
        description,
        due_date: dueDate,
        max_score: maxScore,
        points_deduction_per_day: pointsDeductionPerDay,
        published,
        image_url: imageUrl,
        created_by: profile.id,
      },
    ])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ assignment }, { status: 201 })
}
