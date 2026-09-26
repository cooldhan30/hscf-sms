'use client'

import { useCallback, useRef } from 'react'

// Asks the server whether a left/right card pair belongs together for the
// current MATCH question (POST /sessions/[id]/pair-check). The client
// never holds the pairs; verdicts are cached per question so re-trying a
// known pair costs no request.
export function usePairCheck(sessionId: string) {
  const cache = useRef(new Map<string, boolean>())
  return useCallback(
    async (questionIndex: number, left: string, right: string): Promise<boolean> => {
      const key = `${questionIndex}\u0001${left}\u0001${right}`
      const hit = cache.current.get(key)
      if (hit !== undefined) return hit
      const res = await fetch(`/api/gameroom-v2/sessions/${sessionId}/pair-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex, left, right }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.isPair !== 'boolean') throw new Error(data?.error || 'Could not check that pair')
      cache.current.set(key, data.isPair)
      return data.isPair
    },
    [sessionId]
  )
}
