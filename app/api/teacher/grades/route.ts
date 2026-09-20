import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/require-teacher'
import { getSubmissionSignedUrl } from '@/lib/storage/submissionUrl'
import { getGradeFeedbackSignedUrl } from '@/lib/storage/gradeFeedbackUrl'

// GET /api/teacher/grades?classId=&assignmentId= -- the class roster
// LEFT JOINed with any existing grade for that assignment, so every
// enrolled student shows up (graded or not) without needing a
// pre-created placeholder row per student.
export async function GET(request: Request) {
  const guard = await requireTeacher()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const classId = searchParams.get('classId')
  const assignmentId = searchParams.get('assignmentId')

  if (!classId || !assignmentId) {
    return NextResponse.json({ error: 'classId and assignmentId query params are required' }, { status: 400 })
  }

  // A class can be co-taught (migration 036) -- teacher_id on sms_classes
  // is only the lead/primary teacher, so checking it directly here would
  // wrongly reject a co-teacher RLS itself already allows. This RPC is
  // the same helper "grades: teacher manage own assignment" routes
  // through (via sms_teacher_owns_assignment), so this check can never
  // drift from what RLS actually permits.
  const { data: owns } = await supabase.rpc('sms_teacher_owns_class', { p_class_id: classId })
  if (!owns) {
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
        s.file_url ? getSubmissionSignedUrl(supabase, s.file_url, s.storage_provider, 3600) : null,
        s.audio_url ? getSubmissionSignedUrl(supabase, s.audio_url, s.storage_provider, 3600) : null,
      ])
      return { ...s, fileSignedUrl, audioSignedUrl }
    })
  )

  // Same idea for any previously-recorded audio feedback on a grade --
  // 'grade-feedback' is also a private bucket.
  const gradesWithUrls = await Promise.all(
    (grades ?? []).map(async (g) => ({
      ...g,
      audioFeedbackSignedUrl: g.audio_feedback_url ? await getGradeFeedbackSignedUrl(supabase, g.audio_feedback_url, 3600) : null,
    }))
  )

  return NextResponse.json({
    roster: (enrollments ?? []).map((e) => e.student),
    grades: gradesWithUrls,
    submissions: submissionsWithUrls,
  })
}

// POST /api/teacher/grades -- bulk enter/edit grades for an assignment.
// Body: { assignmentId, records: [{ studentId, score, feedback,
// audioFeedbackPath?, audioFeedbackSize? }] }
//
// audioFeedbackPath/audioFeedbackSize round-trip the CURRENT state for
// each student (existing path if untouched, a new path if the teacher
// just recorded, or null/undefined if removed) -- this is a real
// upsert (replaces every column on conflict, not a partial merge), and
// "Save Grades" always submits the whole visible roster at once, so if
// the client only sent audio fields for students whose recording
// actually changed this save, every OTHER student's existing audio
// feedback would be silently wiped out by this same request. The
// client is responsible for initializing each row's audio state from
// the grade it loaded and only clearing it via an explicit remove
// action -- this route just trusts and persists whatever it's sent,
// same as it already does for score/feedback.
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
  const rows = records.map(
    (
      r: { studentId?: string; score?: unknown; feedback?: string; audioFeedbackPath?: string | null; audioFeedbackSize?: number | null },
      i: number
    ) => {
      if (!r.studentId) errors.push(`records[${i}].studentId is required`)
      const score = r.score === '' || r.score === null || r.score === undefined ? null : Number(r.score)
      if (score !== null && Number.isNaN(score)) errors.push(`records[${i}].score must be a number`)
      return {
        assignment_id: assignmentId,
        student_id: r.studentId,
        score,
        feedback: r.feedback?.trim() || null,
        audio_feedback_url: r.audioFeedbackPath || null,
        audio_feedback_size: typeof r.audioFeedbackSize === 'number' ? r.audioFeedbackSize : null,
        graded_by: profile.id,
        graded_at: new Date().toISOString(),
      }
    }
  )

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
