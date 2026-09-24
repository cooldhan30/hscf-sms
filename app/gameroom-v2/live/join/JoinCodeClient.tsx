'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameV2Card, GameV2Button } from '@/components/gameRoomV2'
import { normalizeJoinCode } from '@/lib/gameRoomV2/liveClassroom'
import { toast } from '@/lib/toast'

// "Enter join code -> Enter authenticated session" -- the student
// flow's first step. A successful join (first-time OR reconnect --
// /join handles both identically) takes the student straight to the
// waiting room; an invalid/unauthorized code shows one generic error
// (see /join route.ts's comment on why "wrong code" and "not enrolled"
// are never distinguished).
export function JoinCodeClient() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const inputId = useId()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    const res = await fetch('/api/gameroom-v2/live/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode: normalizeJoinCode(code) }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (!res.ok) {
      toast.error(data.error || 'Failed to join')
      return
    }
    router.push(`/gameroom-v2/live/play/${data.liveSessionId}`)
  }

  return (
    <GameV2Card padding="lg" className="max-w-sm w-full text-center">
      <div className="text-5xl mb-2" aria-hidden>
        {'\u{1F3AE}'}
      </div>
      <h1 className="text-xl font-extrabold text-gamev2ink-900 dark:text-white">Join a Live Game</h1>
      <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400 mt-1">Enter the code your teacher shared.</p>

      <form onSubmit={handleJoin} className="mt-6 space-y-4">
        {/* sr-only label, not just a placeholder -- placeholder text
            disappears once typing starts and isn't reliably treated as
            the field's accessible name by every screen reader. */}
        <label htmlFor={inputId} className="sr-only">
          Join code
        </label>
        <input
          id={inputId}
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ABCD1234"
          maxLength={12}
          autoCapitalize="characters"
          autoComplete="off"
          className="w-full text-center text-2xl font-black tracking-[0.2em] uppercase px-4 py-4 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900"
        />
        <GameV2Button type="submit" fullWidth disabled={joining || !code.trim()}>
          {joining ? 'Joining...' : 'Join'}
        </GameV2Button>
      </form>
    </GameV2Card>
  )
}
