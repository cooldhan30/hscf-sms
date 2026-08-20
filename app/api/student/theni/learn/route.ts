import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/require-student'

const SESSION_SIZE = 8

// GET /api/student/theni/learn -- the next batch of words for a Theni 1
// learning session: words the student hasn't seen yet first, then words
// still in "learning"/"needs_review" status, capped at SESSION_SIZE so
// a session never turns into scrolling through the whole word list at
// once (spec explicitly calls this out -- teach ~3-10 words per session).
export async function GET() {
  const guard = await requireStudent()
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
  const { supabase, student } = guard

  const { data: enrollment } = await supabase
    .from('sms_theni_enrollments')
    .select('id, season_id')
    .eq('student_id', student.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Not enrolled in Tamil Theni' }, { status: 404 })
  }

  const { data: progressRows } = await supabase
    .from('sms_theni_word_progress')
    .select('word_id, status')
    .eq('enrollment_id', enrollment.id)

  const seenWordIds = new Set((progressRows ?? []).map((p) => p.word_id))
  const needsReviewIds = (progressRows ?? []).filter((p) => p.status === 'needs_review' || p.status === 'learning').map((p) => p.word_id)

  // Prioritize words needing review, then fill the rest with unseen words.
  const words: { id: string; english: string; tamil: string; category_id: string; category: { name_english: string; name_tamil: string; icon: string | null } | null }[] = []

  if (needsReviewIds.length > 0) {
    const { data: reviewWords } = await supabase
      .from('sms_theni_words')
      .select('id, english, tamil, category_id, category:sms_theni_categories(name_english, name_tamil, icon)')
      .in('id', needsReviewIds)
      .eq('status', 'active')
      .limit(SESSION_SIZE)
      .returns<typeof words>()
    words.push(...(reviewWords ?? []))
  }

  if (words.length < SESSION_SIZE) {
    const query = supabase
      .from('sms_theni_words')
      .select('id, english, tamil, category_id, category:sms_theni_categories(name_english, name_tamil, icon)')
      .eq('season_id', enrollment.season_id)
      .eq('difficulty', 'D1')
      .eq('status', 'active')
      .order('category_id')
      .order('word_index')
      .limit(SESSION_SIZE * 3)

    const { data: candidates } = await query.returns<typeof words>()
    for (const w of candidates ?? []) {
      if (words.length >= SESSION_SIZE) break
      if (seenWordIds.has(w.id)) continue
      if (words.some((existing) => existing.id === w.id)) continue
      words.push(w)
    }
  }

  return NextResponse.json({ words: words.slice(0, SESSION_SIZE), enrollmentId: enrollment.id })
}
