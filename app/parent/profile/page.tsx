import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { ParentProfileClient } from './ParentProfileClient'

export const dynamic = 'force-dynamic'

export default async function ParentProfilePage() {
  const supabase = createClient()

  const { userId } = await auth()

  const { data: profile } = await supabase.from('sms_profiles').select('*').eq('id', userId ?? '').single()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Profile</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Update your contact info.</p>
      </div>

      {profile && <ParentProfileClient profile={profile} />}
    </div>
  )
}
