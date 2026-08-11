import { createClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import { AnnouncementsClient } from './AnnouncementsClient'
import type { SmsAnnouncement } from '@/types/database'

export const dynamic = 'force-dynamic'

type AnnouncementRow = SmsAnnouncement & { targets: { class: { id: string; name: string } }[] }

export default async function TeacherAnnouncementsPage() {
  const supabase = createClient()

  const { userId } = await auth()

  const [{ data: classes }, { data: announcements }] = await Promise.all([
    supabase.from('sms_classes').select('id, name, grade_level').order('name'),
    supabase
      .from('sms_announcements')
      .select('*, targets:sms_announcement_classes(class:sms_classes(id, name))')
      .eq('created_by', userId ?? '')
      .order('created_at', { ascending: false })
      .returns<AnnouncementRow[]>(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Announcements</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Post updates to your classes or your grade. Save as draft, publish now, or schedule.
        </p>
      </div>

      <AnnouncementsClient classes={classes ?? []} initialAnnouncements={announcements ?? []} />
    </div>
  )
}
