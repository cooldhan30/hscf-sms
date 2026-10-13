'use client'

import { useEffect, useState } from 'react'
import { normalizePin } from '@/lib/grClassic/live'
import { grcApi } from '../teacher/api'
import { Button, Card, Shell } from '../ui'
import { LivePlayer } from './LivePlayer'

// Student: join a live game with the PIN from the big screen (or by
// scanning its QR code, which opens this page with ?pin=). Login is
// required, so there is no nickname step -- students play under their
// own first name. Reloading the page rejoins the same game.
export function JoinLive({ name }: { name: string }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const join = async (raw: string) => {
    const p = normalizePin(raw)
    if (p.length !== 6) return setError('A game PIN has 6 numbers.')
    setJoining(true)
    setError('')
    const res = await grcApi<{ sessionId: string }>('/live/join', { method: 'POST', body: { pin: p } })
    setJoining(false)
    if (!res.ok) return setError(res.error)
    // Keep the PIN in the address so a reload rejoins the same game.
    const url = new URL(window.location.href)
    url.searchParams.set('pin', p)
    window.history.replaceState(null, '', url.toString())
    setSessionId(res.data.sessionId)
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('pin')
    if (p) {
      setPin(p)
      join(p)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (sessionId) {
    return (
      <LivePlayer
        sessionId={sessionId}
        onLeft={(message) => {
          setSessionId(null)
          setError(message)
        }}
      />
    )
  }

  return (
    <Shell back={{ href: '/gr-classic/student', label: 'Back' }} width="max-w-md">
      <Card className="mt-4 p-6 text-center sm:p-8">
        <h1 className="text-3xl font-black text-slate-900">Join a live game</h1>
        <p className="mt-1 font-semibold text-slate-500">Type the PIN from the big screen</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            join(pin)
          }}
        >
          <label htmlFor="grc-pin" className="sr-only">
            Game PIN
          </label>
          <input
            id="grc-pin"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^\d ]/g, ''))}
            placeholder="Game PIN"
            className="w-full rounded-2xl border-0 bg-slate-50 px-4 py-4 text-center font-sans text-4xl font-black tracking-[0.3em] text-slate-900 ring-2 ring-slate-200 placeholder:text-2xl placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500"
            aria-describedby="grc-pin-error"
          />
          <p id="grc-pin-error" role="alert" className="min-h-[1.5rem] text-sm font-bold text-rose-700">
            {error}
          </p>
          <Button tone="indigo" size="lg" className="w-full" type="submit" disabled={joining}>
            {joining ? 'Joining…' : 'Join ▶'}
          </Button>
        </form>
        <p className="mt-4 text-sm font-semibold text-slate-500">
          Playing as <span className="font-extrabold text-slate-800">{name}</span>
        </p>
      </Card>
    </Shell>
  )
}
