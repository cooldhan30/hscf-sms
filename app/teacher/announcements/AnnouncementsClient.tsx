'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiPlus, FiSend, FiArchive, FiTrash2 } from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { AnnouncementForm, type AnnouncementSubmitPayload } from '@/components/announcements/AnnouncementForm'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { computeDisplayStatus } from '@/components/announcements/AnnouncementStatusBadge'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { SmsAnnouncement } from '@/types/database'

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
}

type AnnouncementRow = SmsAnnouncement & { targets: { class: { id: string; name: string } }[] }

const TABS = ['all', 'draft', 'scheduled', 'published', 'archived'] as const

function audienceLabelFor(a: AnnouncementRow): string {
  if (a.audience_type === 'grade') {
    return `Grade: ${GRADE_LEVEL_OPTIONS.find((g) => g.value === a.grade_level)?.label ?? a.grade_level}`
  }
  return a.targets.map((t) => t.class.name).join(', ') || 'Class'
}

export function AnnouncementsClient({
  classes,
  initialAnnouncements,
}: {
  classes: ClassOption[]
  initialAnnouncements: AnnouncementRow[]
}) {
  const router = useRouter()
  const confirm = useConfirm()
  const [tab, setTab] = useState<(typeof TABS)[number]>('all')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    if (tab === 'all') return initialAnnouncements
    return initialAnnouncements.filter((a) => computeDisplayStatus(a.status, a.publish_at) === tab)
  }, [initialAnnouncements, tab])

  async function handleSubmit(payload: AnnouncementSubmitPayload) {
    const res = await fetch('/api/teacher/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error || 'Something went wrong' }
    toast.success('Announcement saved')
    router.refresh()
  }

  async function publish(a: AnnouncementRow) {
    const res = await fetch(`/api/teacher/announcements/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    })
    if (res.ok) {
      toast.success('Announcement published')
      router.refresh()
    } else {
      toast.error('Failed to publish announcement')
    }
  }

  async function archive(a: AnnouncementRow) {
    const confirmed = await confirm({ title: `Archive "${a.title}"?`, confirmLabel: 'Archive' })
    if (!confirmed) return
    const res = await fetch(`/api/teacher/announcements/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    if (res.ok) {
      toast.success('Announcement archived')
      router.refresh()
    } else {
      toast.error('Failed to archive announcement')
    }
  }

  async function remove(a: AnnouncementRow) {
    const confirmed = await confirm({
      title: `Delete "${a.title}"?`,
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    const res = await fetch(`/api/teacher/announcements/${a.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Announcement deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete announcement')
    }
  }

  if (classes.length === 0) {
    return <EmptyState title="No classes assigned" description="You'll be able to post announcements once you have a class." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-primary-800 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Button variant="primary" icon={<FiPlus />} onClick={() => setModalOpen(true)}>
          New Announcement
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={`No ${tab === 'all' ? '' : tab} announcements`} />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const display = computeDisplayStatus(a.status, a.publish_at)
            return (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                audienceLabel={audienceLabelFor(a)}
                showStatus
                actions={
                  <div className="flex items-center gap-2">
                    {display === 'draft' && (
                      <button
                        onClick={() => publish(a)}
                        className="p-2 rounded-lg text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                        aria-label="Publish"
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    )}
                    {display !== 'archived' && (
                      <button
                        onClick={() => archive(a)}
                        className="p-2 rounded-lg text-gold-700 hover:bg-gold-50 dark:hover:bg-gold-950/40 transition-colors"
                        aria-label="Archive"
                      >
                        <FiArchive className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(a)}
                      className="p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
                      aria-label="Delete"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                }
              />
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} title="New Announcement" onClose={() => setModalOpen(false)}>
        <AnnouncementForm
          scope="teacher"
          classOptions={classes}
          onSubmit={handleSubmit}
          onDone={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  )
}
