'use client'

import { useEffect, useState } from 'react'
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'

interface OrphanedImage {
  path: string
  size: number
  uploadedAt: string | null
  uploaderName: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// These are objects left behind in the assignment-images bucket with no
// assignment row pointing to them anymore -- pure wasted storage. They
// don't show up in the "By Class" breakdown because there's no row to
// attribute them to, which is exactly why an admin needs a direct way
// to find and remove them instead of just seeing an "Untracked" total.
export function OrphanedImagesClient() {
  const confirm = useConfirm()
  const [items, setItems] = useState<OrphanedImage[] | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/storage/orphaned-images')
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
  }, [])

  async function handleDelete(item: OrphanedImage) {
    const confirmed = await confirm({
      title: 'Delete this orphaned image?',
      description: `Uploaded by ${item.uploaderName}, ${formatBytes(item.size)}. It isn't attached to any assignment, so this only frees storage space. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeleting(item.path)
    const res = await fetch('/api/admin/storage/orphaned-images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: item.path }),
    })
    const data = await res.json().catch(() => ({}))
    setDeleting(null)

    if (res.ok) {
      toast.success('Image deleted')
      setItems((prev) => (prev ?? []).filter((i) => i.path !== item.path))
    } else {
      toast.error(data.error || 'Failed to delete image')
    }
  }

  if (items === null) {
    return (
      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="text-sm text-stone-400 dark:text-stone-500">Checking for orphaned files...</p>
      </div>
    )
  }

  const totalBytes = items.reduce((sum, i) => sum + i.size, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FiAlertTriangle className="w-4 h-4 text-terracotta-600 dark:text-terracotta-400" />
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">
          Orphaned Assignment Images {items.length > 0 && `(${formatBytes(totalBytes)})`}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No orphaned images -- nothing to clean up" />
      ) : (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 divide-y divide-stone-100 dark:divide-stone-800">
          {items.map((item) => (
            <div key={item.path} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm text-stone-700 dark:text-stone-200 truncate">{item.path}</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  {item.uploaderName} · {formatBytes(item.size)}
                  {item.uploadedAt ? ` · ${new Date(item.uploadedAt).toLocaleDateString()}` : ''}
                </p>
              </div>
              <button
                onClick={() => handleDelete(item)}
                disabled={deleting === item.path}
                className="flex-shrink-0 p-2 rounded-lg text-terracotta-600 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors disabled:opacity-40"
                aria-label="Delete orphaned image"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
