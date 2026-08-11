import { RichTextContent } from './RichTextContent'
import { AnnouncementStatusBadge } from './AnnouncementStatusBadge'
import type { SmsAnnouncement } from '@/types/database'

export function AnnouncementCard({
  announcement,
  audienceLabel,
  showStatus = false,
  compact = false,
  actions,
}: {
  announcement: SmsAnnouncement
  audienceLabel: string
  showStatus?: boolean
  compact?: boolean
  actions?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-stone-800 dark:text-stone-100">{announcement.title}</h3>
            {showStatus && (
              <AnnouncementStatusBadge status={announcement.status} publishAt={announcement.publish_at} />
            )}
          </div>
          <div className={compact ? 'mt-1 line-clamp-2' : 'mt-2'}>
            <RichTextContent html={announcement.body} className="text-stone-600 dark:text-stone-300" />
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
            {audienceLabel} · {new Date(announcement.created_at).toLocaleDateString()}
            {announcement.publish_at && (
              <> · Scheduled for {new Date(announcement.publish_at).toLocaleString()}</>
            )}
          </p>
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
