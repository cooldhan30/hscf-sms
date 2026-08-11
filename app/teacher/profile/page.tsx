import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { ProfileClient } from './ProfileClient'

export const dynamic = 'force-dynamic'

export default async function TeacherProfilePage() {
  const supabase = createClient()

  const { userId } = await auth()

  const [{ data: profile }, { data: teacher }] = await Promise.all([
    supabase.from('sms_profiles').select('*').eq('id', userId ?? '').single(),
    supabase.from('sms_teachers').select('*').eq('profile_id', userId ?? '').single(),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Profile</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Update your personal and professional information.</p>
      </div>

      {profile && teacher && <ProfileClient profile={profile} teacher={teacher} />}
    </div>
  )
}
