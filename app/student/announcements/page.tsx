import { FiSpeaker } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { SmsAnnouncement } from '@/types/database'

export const dynamic = 'force-dynamic'

type AnnouncementRow = SmsAnnouncement & { targets: { class: { id: string; name: string } }[] }

function audienceLabelFor(a: AnnouncementRow): string {
  switch (a.audience_type) {
    case 'school':
      return 'Entire School'
    case 'teachers':
      return 'All Teachers'
    case 'parents':
      return 'All Parents'
    case 'students':
      return 'All Students'
    case 'grade':
      return `Grade: ${GRADE_LEVEL_OPTIONS.find((g) => g.value === a.grade_level)?.label ?? a.grade_level}`
    case 'class':
      return a.targets.map((t) => t.class.name).join(', ') || 'Your Class'
  }
}

export default async function StudentAnnouncementsPage() {
  const supabase = createClient()

  // RLS ("announcements: student read visible") already scopes this to
  // published, non-scheduled-for-future announcements aimed at this
  // student's classes, their grade level, all students, or the whole
  // school.
  const { data: announcements } = await supabase
    .from('sms_announcements')
    .select('*, targets:sms_announcement_classes(class:sms_classes(id, name))')
    .order('created_at', { ascending: false })
    .returns<AnnouncementRow[]>()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Announcements</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Updates for your classes, your grade, and the whole school.
        </p>
      </div>

      {!announcements || announcements.length === 0 ? (
        <EmptyState icon={FiSpeaker} title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} audienceLabel={audienceLabelFor(a)} />
          ))}
        </div>
      )}
    </div>
  )
}
