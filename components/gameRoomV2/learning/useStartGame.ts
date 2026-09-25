'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/toast'

// Starts a solo session for (question set, engine) through the existing,
// server-validated /api/gameroom-v2/sessions/start route, then opens the
// game. Shared by topic pages, Quick Play, Recommended Next and results.
export function useStartGame() {
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)

  async function start(questionSetId: string, engineId: string, key = `${questionSetId}:${engineId}`) {
    setStarting(key)
    try {
      const res = await fetch('/api/gameroom-v2/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionSetId, engineId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.sessionId) {
        toast.error(data.error || 'Could not start the game. Please try again.')
        setStarting(null)
        return
      }
      router.push(`/gameroom-v2/play/${data.sessionId}`)
    } catch {
      toast.error('Could not start the game. Check your connection and try again.')
      setStarting(null)
    }
  }

  return { start, starting }
}
