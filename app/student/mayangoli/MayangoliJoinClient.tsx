'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export function MayangoliJoinClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Prefills from the QR-code deep link (?code=XXXXXX) generated on the
  // host lobby screen -- the student still confirms by tapping Join,
  // never auto-submits from a scanned link alone.
  useEffect(() => {
    const codeFromLink = searchParams.get('code')
    if (codeFromLink) setJoinCode(codeFromLink.toUpperCase())
  }, [searchParams])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError(null)

    const res = await fetch('/api/mayangoli/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (!res.ok) {
      setJoinError(data.error || 'Failed to join')
      return
    }

    router.push(`/student/mayangoli/${data.sessionId}`)
  }

  return (
    <form onSubmit={handleJoin} className="space-y-3 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      {joinError && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {joinError}
        </p>
      )}
      <input
        type="text"
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        placeholder="Game code"
        maxLength={8}
        className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-center text-lg font-semibold tracking-widest focus:ring-2 focus:ring-primary-600 focus:border-transparent"
      />
      <Button type="submit" variant="primary" fullWidth disabled={joining || !joinCode.trim()}>
        {joining ? 'Joining...' : 'Join Game'}
      </Button>
    </form>
  )
}
