'use client'

import { useState } from 'react'
import { GameV2Modal, GameV2Button } from '@/components/gameRoomV2'
import { toast } from '@/lib/toast'

export function AssignModal({
  open,
  onClose,
  setId,
  setTitle,
  classes,
  onAssigned,
}: {
  open: boolean
  onClose: () => void
  setId: string
  setTitle: string
  classes: { id: string; name: string }[]
  onAssigned: () => void
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAssign() {
    if (!classId) {
      setError('Choose a class')
      return
    }
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/gameroom-v2/question-sets/${setId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(data.error || 'Failed to assign question set')
      return
    }
    toast.success(`Assigned "${setTitle}" to your class`)
    onAssigned()
    onClose()
  }

  return (
    <GameV2Modal open={open} onClose={onClose} title="Assign to a Class">
      {classes.length === 0 ? (
        <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400">You don&apos;t have any classes to assign to.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
            Attach &quot;{setTitle}&quot; to one of your classes -- this is the set&apos;s CONTENT, not a specific
            game, so any compatible game engine can use it once it&apos;s available.
          </p>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-gamev2coral-600 dark:text-gamev2coral-400">{error}</p>}
          <GameV2Button variant="spark" fullWidth disabled={saving} onClick={handleAssign}>
            {saving ? 'Assigning...' : 'Assign'}
          </GameV2Button>
        </div>
      )}
    </GameV2Modal>
  )
}
