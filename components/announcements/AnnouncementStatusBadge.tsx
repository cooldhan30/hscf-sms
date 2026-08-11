import type { SmsAnnouncementStatus } from '@/types/database'

export function computeDisplayStatus(
  status: SmsAnnouncementStatus,
  publishAt: string | null
): 'draft' | 'scheduled' | 'published' | 'archived' {
  if (status === 'draft') return 'draft'
  if (status === 'archived') return 'archived'
  // status === 'published'
  if (publishAt && new Date(publishAt).getTime() > Date.now()) return 'scheduled'
  return 'published'
}

const STYLES: Record<string, string> = {
  draft: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  scheduled: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300',
  published: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300',
  archived: 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300',
}

const LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
}

export function AnnouncementStatusBadge({
  status,
  publishAt,
}: {
  status: SmsAnnouncementStatus
  publishAt: string | null
}) {
  const display = computeDisplayStatus(status, publishAt)
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${STYLES[display]}`}>
      {LABELS[display]}
    </span>
  )
}
