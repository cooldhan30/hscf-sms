import { createAdminClient } from '@/lib/supabase/admin'
import { TheniAdminClient } from './TheniAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminTheniPage() {
  const admin = createAdminClient()

  const { data: seasons } = await admin
    .from('sms_theni_seasons')
    .select('*, enrollments:sms_theni_enrollments(count), words:sms_theni_words(count)')
    .order('year', { ascending: false })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Tamil Theni</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Manage Tamil Theni seasons and share join codes with students.
        </p>
      </div>

      <TheniAdminClient seasons={seasons ?? []} />
    </div>
  )
}
