import { redirect } from 'next/navigation'
import { Home } from '@/components/grClassic/Home'
import { getCurrentProfile } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GameRoom Classic home: each person goes straight to their own page --
// students to the student home, teachers to the teacher home -- so nobody
// sees the other side. Anyone else (e.g. an admin) sees the overview.
export default async function GrClassicHomePage() {
  const profile = await getCurrentProfile()
  if (profile?.role === 'student') redirect('/gr-classic/student')
  if (profile?.role === 'teacher') redirect('/gr-classic/teacher')
  return <Home />
}
