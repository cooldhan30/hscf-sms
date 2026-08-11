import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'

// GET /api/teacher/grades?classId=&assignmentId= -- the class roster
// LEFT JOINed with any existing grade for that assignment, so every
// enrolled student shows up (graded or not) without needing a
// pre-created placeholder row per student.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase, teacher } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const assignmentId = searchParams.get('assignmentId')

  if (!classId || !assignmentId) {
    return NextResponse.json({ error: 'classId and assignmentId query params are required' }, { status: 400 })
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

  const [{ data: enrollments }, { data: grades }, { data: submissions }] = await Promise.all([
    supabase
      .from('sms_class_enrollments')
      .select('student:sms_students(*)')
      .eq('class_id', classId)
      .eq('status', 'active')
      .returns<{ student: { id: string; first_name: string; last_name: string } }[]>(),
    supabase.from('sms_grades').select('*').eq('assignment_id', assignmentId),
    supabase.from('sms_submissions').select('*').eq('assignment_id', assignmentId),
  ])

  // Signed URLs for any file/audio submissions -- the 'submissions'
  // bucket is private, so the roster response needs short-lived signed
  // links rather than raw storage paths for the gradebook UI to play/open.
  const submissionsWithUrls = await Promise.all(
    (submissions ?? []).map(async (s) => {
      const [fileSignedUrl, audioSignedUrl] = await Promise.all([
        s.file_url
          ? supabase.storage
              .from('submissions')
              .createSignedUrl(s.file_url, 3600)
              .then((r) => r.data?.signedUrl ?? null)
          : null,
        s.audio_url
          ? supabase.storage
              .from('submissions')
              .createSignedUrl(s.audio_url, 3600)
              .then((r) => r.data?.signedUrl ?? null)
          : null,
      ])
      return { ...s, fileSignedUrl, audioSignedUrl }
    })
  )

  return NextResponse.json({
    roster: (enrollments ?? []).map((e) => e.student),
    grades: grades ?? [],
    submissions: submissionsWithUrls,
  })
}

// POST /api/teacher/grades -- bulk enter/edit grades for an assignment.
// Body: { assignmentId, records: [{ studentId, score, feedback }] }
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

  const { assignmentId, records } = body
  if (!assignmentId || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'assignmentId and a non-empty records array are required' }, { status: 400 })
  }

  const errors: string[] = []
  const rows = records.map((r: { studentId?: string; score?: unknown; feedback?: string }, i: number) => {
    if (!r.studentId) errors.push(`records[${i}].studentId is required`)
    const score = r.score === '' || r.score === null || r.score === undefined ? null : Number(r.score)
    if (score !== null && Number.isNaN(score)) errors.push(`records[${i}].score must be a number`)
    return {
      assignment_id: assignmentId,
      student_id: r.studentId,
      score,
      feedback: r.feedback?.trim() || null,
      graded_by: profile.id,
      graded_at: new Date().toISOString(),
    }
  })

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  // RLS ("grades: teacher manage own assignment") enforces the assignment
  // actually belongs to one of this teacher's classes.
  const { error } = await supabase.from('sms_grades').upsert(rows, { onConflict: 'assignment_id,student_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
