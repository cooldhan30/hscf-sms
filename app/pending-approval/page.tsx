import { redirect } from 'next/navigation'
import { auth, currentUser } from '@clerk/nextjs/server'
import { SignOutButton } from '@clerk/nextjs'
import { FiUser } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { CompleteProfileForm } from '@/components/CompleteProfileForm'
import { createClient } from '@/lib/supabase/server'
import { roleHomePath } from '@/lib/role-home-path'

export default async function PendingApprovalPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/login')
  }

  const supabase = createClient()
  const { data: profile } = await supabase
    .from('sms_profiles')
    .select('role, first_name, last_name')
    .eq('id', userId)
    .single()

  // Already has a real role (e.g. they navigated back here after finishing
  // onboarding, or refreshed at exactly the wrong moment) -- send them
  // where they actually belong instead of showing the form again.
  if (profile && profile.role !== 'pending') {
    redirect(roleHomePath(profile.role))
  }

  // profile can be null here if the Clerk webhook (user.created) hasn't
  // landed yet -- it can lag a few seconds, or never arrive at all in
  // local dev if the webhook tunnel isn't running. Rather than blocking
  // on it, show the form immediately with Clerk's own name as a
  // fallback; /api/me/complete-profile creates the sms_profiles row
  // itself if it's still missing when the form is submitted.
  const clerkUser = profile ? null : await currentUser()

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200 dark:border-stone-800 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center">
            <FiUser className="w-6 h-6 text-primary-700 dark:text-primary-400" />
          </div>
          <h1 className="text-xl font-bold text-primary-900 dark:text-white mb-1">One More Step</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Tell us who you are so we can take you to the right place.
          </p>
        </div>

        <CompleteProfileForm
          defaultFirstName={profile?.first_name ?? clerkUser?.firstName ?? ''}
          defaultLastName={profile?.last_name ?? clerkUser?.lastName ?? ''}
        />

        <div className="mt-6 text-center">
          <SignOutButton>
            <Button variant="secondary" fullWidth>
              Sign Out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  )
}
