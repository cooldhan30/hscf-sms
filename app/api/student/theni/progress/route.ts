import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'

// XP values -- kept here as named constants (not scattered through the
// UI) so they're the one place to tune later, per the spec's
// "configurable" requirement. A real admin-configurable settings row is
// a Phase 3 concern; for now this is the single source of truth.
const XP_NEW_WORD = 10
const XP_CORRECT = 5
const XP_FIRST_TRY_BONUS = 10
const XP_STREAK_DAILY_BONUS = 10

// Mastery thresholds -- crude spaced-repetition-inspired status ladder,
// not a full SM-2 algorithm. Good enough for Phase 1/2; a real interval
// scheduler (next_review_at spacing) is a later refinement once there's
// real usage data to tune against.
function nextStatus(current: string, wasCorrect: boolean, correctCount: number, incorrectCount: number): string {
  if (!wasCorrect) return incorrectCount >= 2 ? 'needs_review' : 'learning'
  if (correctCount >= 3) return 'mastered'
  if (correctCount >= 1) return 'practicing'
  return 'learning'
}

// POST /api/student/theni/progress -- record one answer (correct/
// incorrect) for one word, update that word's mastery row, award XP,
// and roll the day's streak forward. Called once per question in the
// learning/practice loop.
export async function POST(request: Request) {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const body = await request.json().catch(() => null)
  if (!body || typeof body.wordId !== 'string' || typeof body.correct !== 'boolean') {
    return NextResponse.json({ error: 'wordId and correct are required' }, { status: 400 })
  }
  const { wordId, correct } = body

  const { data: enrollment } = await supabase
    .from('sms_theni_enrollments')
    .select('*')
    .eq('student_id', student.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in Tamil Theni' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('sms_theni_word_progress')
    .select('*')
    .eq('enrollment_id', enrollment.id)
    .eq('word_id', wordId)
    .maybeSingle()

  const isNewWord = !existing
  const correctCount = (existing?.correct_count ?? 0) + (correct ? 1 : 0)
  const incorrectCount = (existing?.incorrect_count ?? 0) + (correct ? 0 : 1)
  const status = nextStatus(existing?.status ?? 'new', correct, correctCount, incorrectCount)

  const { error: progressError } = await supabase.from('sms_theni_word_progress').upsert(
    [
      {
        enrollment_id: enrollment.id,
        word_id: wordId,
        exposure_count: (existing?.exposure_count ?? 0) + 1,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        mastery_score: correctCount + incorrectCount > 0 ? correctCount / (correctCount + incorrectCount) : 0,
        status,
        last_practiced_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'enrollment_id,word_id' }
  )
  if (progressError) {
    return NextResponse.json({ error: progressError.message }, { status: 400 })
  }

  // XP + streak bookkeeping on the enrollment row.
  let xpEarned = correct ? XP_CORRECT : 0
  if (isNewWord) xpEarned += XP_NEW_WORD
  if (isNewWord && correct) xpEarned += XP_FIRST_TRY_BONUS

  const today = new Date().toISOString().slice(0, 10)
  const lastActive = enrollment.last_active_date
  let currentStreak = enrollment.current_streak_days
  let longestStreak = enrollment.longest_streak_days

  if (lastActive !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    // Gentle streak handling per spec: a missed day resets to 1 (today),
    // not to 0 -- a student who comes back still feels like they're
    // starting a new streak today, not being punished with a blank slate.
    currentStreak = lastActive === yesterday ? currentStreak + 1 : 1
    longestStreak = Math.max(longestStreak, currentStreak)
    xpEarned += XP_STREAK_DAILY_BONUS
  }

  const { error: enrollmentError } = await supabase
    .from('sms_theni_enrollments')
    .update({
      xp: enrollment.xp + xpEarned,
      current_streak_days: currentStreak,
      longest_streak_days: longestStreak,
      last_active_date: today,
    })
    .eq('id', enrollment.id)

  if (enrollmentError) {
    return NextResponse.json({ error: enrollmentError.message }, { status: 400 })
  }

  return NextResponse.json({ xpEarned, status, currentStreak })
}
