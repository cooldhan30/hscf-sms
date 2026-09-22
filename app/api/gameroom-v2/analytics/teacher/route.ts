import { NextResponse } from 'next/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import {
  masteryByDimension,
  masteryByConcept,
  improvementOverTime,
  conceptsNeedingAttention,
  commonMistakes,
  DIMENSION_LABELS,
  type LearningEvent,
} from '@/lib/gameRoomV2/analytics'

// GET /api/gameroom-v2/analytics/teacher?questionSetId=... -- the
// TEACHER analytics surface: class accuracy, question accuracy (via
// dimension/concept breakdowns), topic mastery, students needing
// practice, common mistakes, and improvement over time -- for one
// Question Set at a time (a teacher picks a set the same way the
// Builder/Library already scope everything else). Tracks EDUCATIONAL
// performance (sms_gamev2_learning_events, migration 078) entirely
// independently from game performance (score/XP/coins) -- this route
// never reads sms_gamev2_sessions' score/xp_earned/coins_earned at all.
//
// RLS ("gamev2_learning_events: teacher read own set events") is the
// real scoping: a teacher only ever sees events for sets THEY created,
// enforced at the database layer, not just by this route filtering on
// questionSetId.
export async function GET(request: Request) {
  const guard = await requireGameV2Teacher()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase } = guard

  const { searchParams } = new URL(request.url)
  const questionSetId = searchParams.get('questionSetId')
  if (!questionSetId) {
    return NextResponse.json({ error: 'questionSetId is required' }, { status: 400 })
  }

  const { data: rows, error } = await supabase
    .from('sms_gamev2_learning_events')
    .select('student_id, dimension, concept_tags, is_correct, response_time_ms, answered_at, confusion_pair_key')
    .eq('question_set_id', questionSetId)
    .order('answered_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // An empty result here means either "no one has played this set yet"
  // or "you don't own this set" (RLS silently returns zero rows for
  // the latter, same as every other RLS-scoped GameRoom V2 read) -- the
  // response is honestly empty in both cases rather than trying to
  // distinguish them, since distinguishing would require a second query
  // that leaks whether a set with this id exists at all to a caller who
  // doesn't own it.
  const events: LearningEvent[] = (rows ?? []).map((r) => ({
    studentId: r.student_id,
    dimension: r.dimension as LearningEvent['dimension'],
    conceptTags: r.concept_tags ?? [],
    isCorrect: r.is_correct,
    responseTimeMs: r.response_time_ms,
    answeredAt: r.answered_at,
  }))

  const classAccuracy = events.length > 0 ? Math.round((events.filter((e) => e.isCorrect).length / events.length) * 1000) / 10 : 0

  const dimensionMastery = masteryByDimension(events).map((m) => ({
    ...m,
    label: DIMENSION_LABELS[m.key as keyof typeof DIMENSION_LABELS]?.name ?? m.key,
    tamilLabel: DIMENSION_LABELS[m.key as keyof typeof DIMENSION_LABELS]?.tamilName ?? m.key,
  }))
  const conceptMastery = masteryByConcept(events)
  const attention = conceptsNeedingAttention(events)
  const improvement = improvementOverTime(events)

  const confusionRows = (rows ?? []).map((r) => ({ studentId: r.student_id, confusionPairKey: r.confusion_pair_key }))
  const mistakes = commonMistakes(confusionRows)

  // Resolve student display names for every student appearing in ANY
  // "needs practice" list -- fetched once, in one query, rather than
  // per-concept.
  const studentIds = Array.from(new Set(attention.flatMap((a) => a.studentsNeedingPractice.map((s) => s.studentId))))
  const { data: students } = studentIds.length > 0 ? await supabase.from('sms_students').select('id, profile_id').in('id', studentIds) : { data: [] }
  const profileIds = (students ?? []).map((s) => s.profile_id).filter(Boolean)
  const { data: profiles } = profileIds.length > 0 ? await supabase.from('sms_profiles').select('id, first_name, last_name').in('id', profileIds) : { data: [] }
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))
  const studentNameById = new Map(
    (students ?? []).map((s) => {
      const profile = profileById.get(s.profile_id)
      const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : 'Unknown student'
      return [s.id, name || 'Unknown student']
    })
  )

  const conceptsNeedingAttentionResponse = attention.map((a) => ({
    concept: a.concept,
    classAccuracyPct: a.classSummary.accuracyPct,
    totalAttempts: a.classSummary.totalCount,
    studentsNeedingPractice: a.studentsNeedingPractice.map((s) => ({
      studentId: s.studentId,
      studentName: studentNameById.get(s.studentId) ?? 'Unknown student',
      accuracyPct: s.accuracyPct,
      correctCount: s.correctCount,
      totalCount: s.totalCount,
    })),
  }))

  return NextResponse.json({
    totalAnswers: events.length,
    classAccuracyPct: classAccuracy,
    dimensionMastery,
    conceptMastery,
    conceptsNeedingAttention: conceptsNeedingAttentionResponse,
    commonMistakes: mistakes,
    improvement,
  })
}
