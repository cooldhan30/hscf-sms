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
  const { supabase, profile } = guard

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
  const resourceId = optionalString(body.resourceId)

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  // A class can be co-taught (migration 036) -- teacher_id on sms_classes
  // is only the lead/primary teacher, so checking it directly here would
  // wrongly reject a co-teacher RLS itself already allows. This RPC is
  // the same helper "assignments: teacher manage own class" routes
  // through, so this check can never drift from what RLS actually permits.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
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
        resource_id: resourceId,
        // A reading exercise's "submission" is the student recording
        // themselves reading it, not typed text or a separate file --
        // SubmissionForm already renders exactly the right inputs based
        // on this list, so audio-only here is the whole fix.
        ...(resourceId ? { allow_submission_types: ['audio'] } : {}),
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
