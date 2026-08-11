import { createClient } from '@/lib/supabase/server'
import { AdminAnnouncementsClient } from './AdminAnnouncementsClient'
import type { SmsAnnouncement } from '@/types/database'

export const dynamic = 'force-dynamic'

type AnnouncementRow = SmsAnnouncement & { targets: { class: { id: string; name: string } }[] }

export default async function AdminAnnouncementsPage() {
  const supabase = createClient()

  const [{ data: classes }, { data: announcements }] = await Promise.all([
    supabase.from('sms_classes').select('id, name, grade_level').order('name'),
    supabase
      .from('sms_announcements')
      .select('*, targets:sms_announcement_classes(class:sms_classes(id, name))')
      .order('created_at', { ascending: false })
      .returns<AnnouncementRow[]>(),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Announcements</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Post updates to the school, a role, a grade, or a class. Save as draft, publish now, or schedule.
        </p>
      </div>

      <AdminAnnouncementsClient classes={classes ?? []} initialAnnouncements={announcements ?? []} />
    </div>
  )
}
