import { auth } from '@clerk/nextjs/server'
import { createClient } from '@/lib/supabase/server'
import { TheniJoinClient } from './TheniJoinClient'
import { TheniDashboardClient } from './TheniDashboardClient'

export const dynamic = 'force-dynamic'

export default async function StudentTheniPage() {
  const { userId } = await auth()
  const supabase = createClient()

  const { data: student } = await supabase.from('sms_students').select('id, first_name').eq('profile_id', userId ?? '').single()

  if (!student) {
    return <TheniJoinClient />
  }

  const { data: enrollment } = await supabase
    .from('sms_theni_enrollments')
    .select('*, season:sms_theni_seasons(id, name), level:sms_theni_levels(id, level_number, name_tamil, name_english)')
    .eq('student_id', student.id)
    .maybeSingle()

  if (!enrollment) {
    return <TheniJoinClient />
  }

  const [{ data: levels }, { count: wordProgressCount }, { count: masteredCount }] = await Promise.all([
    supabase
      .from('sms_theni_levels')
      .select('id, level_number, name_tamil, name_english, sort_order')
      .eq('season_id', enrollment.season_id)
      .order('sort_order'),
    supabase
      .from('sms_theni_word_progress')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id),
    supabase
      .from('sms_theni_word_progress')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .eq('status', 'mastered'),
  ])

  const { count: totalWordsInSeason } = await supabase
    .from('sms_theni_words')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', enrollment.season_id)

  return (
    <TheniDashboardClient
      studentName={student.first_name}
      enrollment={enrollment}
      levels={levels ?? []}
      wordsExposed={wordProgressCount ?? 0}
      wordsMastered={masteredCount ?? 0}
      totalWords={totalWordsInSeason ?? 0}
    />
  )
}
