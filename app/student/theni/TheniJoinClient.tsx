'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export function TheniJoinClient() {
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
      router.refresh()
    } else {
      setError(data.error || 'Failed to join')
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 text-center space-y-6">
      <div className="text-6xl">🐝</div>
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Tamil Theni</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-2">
          A fun vocabulary adventure to help you prepare for the National Tamil Theni competition. Ask your teacher
          for this season&apos;s join code to get started.
        </p>
      </div>

      <form onSubmit={handleJoin} className="space-y-3">
        {error && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter join code"
          maxLength={8}
          className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white text-center text-lg font-semibold tracking-widest focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
        <Button type="submit" variant="primary" fullWidth disabled={joining || !code.trim()}>
          {joining ? 'Joining...' : 'Join Tamil Theni'}
        </Button>
      </form>
    </div>
  )
}
