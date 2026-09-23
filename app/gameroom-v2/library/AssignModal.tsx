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
  currentClassId,
  onAssigned,
}: {
  open: boolean
  onClose: () => void
  setId: string
  setTitle: string
  classes: { id: string; name: string }[]
  // The class this set is ALREADY assigned to, if any -- lets the modal
  // warn a teacher that re-assigning REPLACES this, rather than adding
  // to it (sms_gamev2_question_sets.class_id is a single column, not a
  // list -- see assign/route.ts's plain .update()).
  currentClassId?: string | null
  onAssigned: () => void
}) {
  const [classId, setClassId] = useState(currentClassId || classes[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentClass = classes.find((c) => c.id === currentClassId)
  const willReassign = Boolean(currentClassId) && classId !== currentClassId

  async function handleAssign() {
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
            game, so any compatible game engine can play it.
          </p>
          {currentClass && (
            <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500">
              Currently assigned to <span className="font-bold">{currentClass.name}</span>.
            </p>
          )}
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
          {willReassign && (
            <p className="text-sm text-gamev2spark-700 dark:text-gamev2spark-300 bg-gamev2spark-50 dark:bg-gamev2spark-500/10 rounded-xl px-3 py-2">
              This set can only be assigned to one class at a time -- assigning it here will move it away from &quot;{currentClass?.name}&quot;.
            </p>
          )}
          {error && <p className="text-sm text-gamev2coral-600 dark:text-gamev2coral-400">{error}</p>}
          <GameV2Button variant="spark" fullWidth disabled={saving} onClick={handleAssign}>
            {saving ? 'Assigning...' : willReassign ? 'Move to This Class' : 'Assign'}
          </GameV2Button>
        </div>
      )}
    </GameV2Modal>
  )
}
