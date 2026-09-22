'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameV2Modal, GameV2Button, GameV2Loading, GameV2Empty } from '@/components/gameRoomV2'
import { toast } from '@/lib/toast'

interface ClassOption {
  id: string
  name: string
  grade_level: string | null
}

// The teacher flow's "Host Live" step: pick which class this live
// session is FOR (the enrollment-authorization anchor every joining
// student gets checked against), then create it and hand off to the
// host dashboard. A teacher with no classes sees an honest empty state
// rather than a picker with nothing in it.
export function HostLiveModal({
  open,
  onClose,
  questionSetId,
  engineId,
  setTitle,
}: {
  open: boolean
  onClose: () => void
  questionSetId: string
  engineId: string
  setTitle: string
}) {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassOption[] | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/gameroom-v2/live/classes')
      .then((res) => res.json())
      .then((data) => setClasses(data.classes ?? []))
      .catch(() => setClasses([]))
  }, [open])

  async function handleHost(classId: string) {
    setCreating(true)
    const res = await fetch('/api/gameroom-v2/live/host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionSetId, engineId, classId }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      toast.error(data.error || 'Failed to host live session')
      return
    }
    router.push(`/gameroom-v2/live/host/${data.liveSessionId}`)
  }

  return (
    <GameV2Modal open={open} onClose={onClose} title="Host Live">
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mb-4">
        Which class is &quot;{setTitle}&quot; for? Students in that class will be able to join with the code.
      </p>

      {classes === null ? (
        <GameV2Loading label="Loading your classes..." />
      ) : classes.length === 0 ? (
        <GameV2Empty title="No classes yet" description="You need at least one class before hosting a live session." />
      ) : (
        <div className="grid gap-2">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={creating}
              onClick={() => handleHost(c.id)}
              className="text-left rounded-2xl border-2 border-gamev2ink-100 dark:border-gamev2ink-800 hover:border-gamev2spark-400 p-4 transition-colors disabled:opacity-50"
            >
              <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100">{c.name}</p>
              {c.grade_level && <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500">{c.grade_level}</p>}
            </button>
          ))}
        </div>
      )}

      {creating && (
        <div className="mt-4">
          <GameV2Button fullWidth disabled>
            Starting...
          </GameV2Button>
        </div>
      )}
    </GameV2Modal>
  )
}
