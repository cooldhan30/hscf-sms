import { createClient } from '@/lib/supabase/server'
import { PromotionsClient, type PromotionClass, type PromotionHistoryRow } from './PromotionsClient'

export const dynamic = 'force-dynamic'

export default async function AdminPromotionsPage() {
  const supabase = createClient()

  const [{ data: classes }, { data: history }] = await Promise.all([
    supabase
      .from('sms_classes')
      .select('id, name, grade_level, academic_year')
      .order('academic_year', { ascending: false })
      .order('name')
      .returns<PromotionClass[]>(),
    supabase
      .from('sms_class_promotions')
      .select(
        'id, student_count, created_at, undone_at, source:source_class_id(name, academic_year), target:target_class_id(name, academic_year)'
      )
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<PromotionHistoryRow[]>(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Class Promotions</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Move a whole class up to next year&apos;s class. Everyone enrolled moves together, and you can
          review the list before anything is saved.
        </p>
      </div>

      <PromotionsClient classes={classes ?? []} history={history ?? []} />
    </div>
  )
}
