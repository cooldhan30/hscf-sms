import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { AdminProfileClient } from './AdminProfileClient'

export const dynamic = 'force-dynamic'

// Admins have no secondary table (sms_teachers/sms_students/sms_parents)
// -- just an sms_profiles row with role='admin' -- so this is a single
// fetch/update, unlike the other three roles' profile pages.
export default async function AdminProfilePage() {
  const supabase = createClient()
  const { userId } = await auth()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId ?? '').single()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Profile</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Update your personal information.</p>
      </div>

      {profile && <AdminProfileClient profile={profile} />}
    </div>
  )
}
