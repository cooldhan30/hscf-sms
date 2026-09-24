import { NextResponse } from 'next/server'
import { requireGameV2Student } from '@/lib/gameRoomV2/requireStudentAccess'
import { pickChallengeConcepts, challengeMessage, type LearningEvent } from '@/lib/gameRoomV2/analytics'

// GET /api/gameroom-v2/analytics/student-challenge -- இன்றைய சவால்
// ("Today's Challenge") for the CURRENT student: which concept(s) their
// own accuracy history suggests would benefit from more practice, with
// constructive (never discouraging) framing. Distinct from the
// PROGRESSION system's daily challenge (lib/gameRoomV2/progression/
// dailyChallenge.ts, "complete 3 sessions today") -- that one is about
// PLAY ACTIVITY and grants XP/coins; this one is about WHICH CONCEPTS
// to focus on and grants nothing itself (a student picks a Question Set
// covering the suggested concept and plays it normally -- this route
// only ever reads and suggests, never a reward path).
export async function GET() {
  const guard = await requireGameV2Student()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const { data: rows, error } = await supabase
    .from('sms_gamev2_learning_events')
    .select('dimension, concept_tags, is_correct, response_time_ms, answered_at')
    .eq('student_id', student.id)
    .order('answered_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const events: LearningEvent[] = (rows ?? []).map((r) => ({
    studentId: student.id,
    dimension: r.dimension as LearningEvent['dimension'],
    conceptTags: r.concept_tags ?? [],
    isCorrect: r.is_correct,
    responseTimeMs: r.response_time_ms,
    answeredAt: r.answered_at,
  }))

  const concepts = pickChallengeConcepts(events)

  return NextResponse.json({
    concepts,
    message: challengeMessage(concepts),
  })
}
