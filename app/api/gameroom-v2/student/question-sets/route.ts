import { NextResponse } from 'next/server'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { gameAvailability, isEngineLaunchable } from '@/lib/gameRoomV2/gameAvailability'

// GET /api/gameroom-v2/student/question-sets?engineId=... -- the Question
// Sets the calling student can play ON THEIR OWN with the given engine:
// published by their teacher, scoped to a class the student is actively
// enrolled in (or unassigned to any class), non-empty, and compatible
// with the engine. Metadata only -- never question content. RLS
// ("student tester read published" / "student read published") is the
// outer boundary; the class filter narrows it to the student's classes.
export async function GET(request: Request) {
  const guard = await requireGameV2Student()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const engineId = new URL(request.url).searchParams.get('engineId') ?? ''
  const engine = getGameEngineV2(engineId)
  if (!engine || !isEngineLaunchable(engine)) {
    return NextResponse.json({ questionSets: [] })
  }

  const [{ data: sets }, { data: enrollments }] = await Promise.all([
    supabase
      .from('sms_gamev2_question_sets')
      .select('id, title, tamil_title, class_id, question_types, question_count, estimated_duration_minutes')
      .eq('published', true)
      .gt('question_count', 0)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase.from('sms_class_enrollments').select('class_id').eq('student_id', student.id).eq('status', 'active'),
  ])

  const myClassIds = new Set((enrollments ?? []).map((e) => e.class_id))

  const questionSets = (sets ?? [])
    .filter((s) => s.class_id === null || myClassIds.has(s.class_id))
    .filter((s) => gameAvailability(engine, s.question_types ?? [], 'solo').playable)
    .map((s) => ({
      id: s.id,
      title: s.title,
      tamilTitle: s.tamil_title,
      questionCount: s.question_count,
      estimatedDurationMinutes: s.estimated_duration_minutes,
    }))

  return NextResponse.json({ questionSets })
}
