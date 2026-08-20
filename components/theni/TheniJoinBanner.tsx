'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

// Discoverability fix: a student has no sidebar link to Tamil Theni
// until they've already joined (see app/student/layout.tsx), so without
// this banner the only way to find /student/theni is a direct URL --
// confirmed as a real gap when a student tried entering a Tamil Theni
// code into the regular "Join a Class" box instead. Shown only on the
// main dashboard, only for students not yet enrolled in any season.
export function TheniJoinBanner() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    setError(null)

    const res = await fetch('/api/student/theni/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    const data = await res.json().catch(() => ({}))
    setJoining(false)

    if (res.ok) {
      router.push('/student/theni')
      router.refresh()
    } else {
      setError(data.error || 'Failed to join')
    }
  }

  return (
    <div className="p-5 rounded-2xl border border-gold-300 dark:border-gold-800 bg-gradient-to-r from-primary-50 to-gold-50 dark:from-primary-950/40 dark:to-gold-950/40">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">🐝</span>
          <div>
            <p className="font-bold text-stone-800 dark:text-stone-100">Join Tamil Theni</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              A fun vocabulary adventure to prepare for the National Tamil Theni competition.
            </p>
          </div>
        </div>
        <form onSubmit={handleJoin} className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Join code"
            maxLength={8}
            className="w-36 px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-sm font-semibold tracking-widest text-center focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
          <Button type="submit" variant="primary" disabled={joining || !code.trim()}>
            {joining ? 'Joining...' : 'Join'}
          </Button>
        </form>
      </div>
      {error && <p className="text-sm text-terracotta-700 dark:text-terracotta-300 mt-3">{error}</p>}
    </div>
  )
}
