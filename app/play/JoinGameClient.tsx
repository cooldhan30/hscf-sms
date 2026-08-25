'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

// No Clerk account, no login -- this is the fully public entry point for
// Game Room (see lib/gameRoom/requirePlayer.ts for why the whole player-
// facing API surface uses a bearer token instead of RLS). Lives at the
// top level (app/play, not nested under /student) specifically because
// it's confirmed to pass through middleware.ts untouched today -- no
// role prefix means no auth redirect.
export function JoinGameClient() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim() || !nickname.trim()) return
    setJoining(true)
    setError(null)

    const res = await fetch('/api/game-room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode, nickname }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (!res.ok) {
      setError(data.error || 'Failed to join')
      return
    }

    localStorage.setItem(`gameRoom:${data.sessionId}:playerToken`, data.playerToken)
    router.push(`/play/${data.sessionId}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        <div className="text-6xl">🎮</div>
        <div>
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-2">Enter the code your teacher gave you and pick a name.</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Game code"
            maxLength={8}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-center text-lg font-semibold tracking-widest focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Your name"
            maxLength={30}
            className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-center text-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
          <Button type="submit" variant="primary" fullWidth disabled={joining || !joinCode.trim() || !nickname.trim()}>
            {joining ? 'Joining...' : 'Join Game'}
          </Button>
        </form>
      </div>
    </div>
  )
}
