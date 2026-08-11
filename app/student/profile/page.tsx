import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { StudentProfileClient } from './StudentProfileClient'

export const dynamic = 'force-dynamic'

export default async function StudentProfilePage() {
  const supabase = createClient()

  const { userId } = await auth()

  const [{ data: profile }, { data: student }] = await Promise.all([
    supabase.from('sms_profiles').select('*').eq('id', userId ?? '').single(),
    supabase.from('sms_students').select('*').eq('profile_id', userId ?? '').single(),
  ])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Profile</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Update your contact info. Other fields are managed by the school.
        </p>
      </div>

      {profile && student && <StudentProfileClient profile={profile} student={student} />}
    </div>
  )
}
