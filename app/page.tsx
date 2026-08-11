import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { getCurrentProfile, roleHomePath } from '@/lib/auth'

export default async function RootPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/login')
  }

  const profile = await getCurrentProfile()

  if (profile) {
    redirect(roleHomePath(profile.role))
  }

  // Signed in but no usable profile (no row yet -- the webhook hasn't
  // caught up -- or an inactive account): NEVER send this case to /login,
  // middleware bounces signed-in users away from /login right back here,
  // which is exactly the loop this page used to cause.
  redirect('/pending-approval')
}
