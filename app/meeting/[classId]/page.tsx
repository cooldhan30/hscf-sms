import type { Metadata } from 'next'
import { ClassMeetingPage } from '@/components/meetings/ClassMeetingPage'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Class meeting · Tamizhi' }

// The meeting in its own browser tab, opened from every portal's Meetings
// list. Deliberately outside the role layouts (no sidebar): navigating the
// portal happens in the original tab, so the call here never drops.
// Middleware requires a signed-in, active account; ClassMeetingPage and the
// token endpoint decide (via RLS) whether this person belongs in the class.
export default function StandaloneMeetingPage({ params }: { params: { classId: string } }) {
  return (
    <main className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <ClassMeetingPage classId={params.classId} standalone />
    </main>
  )
}
