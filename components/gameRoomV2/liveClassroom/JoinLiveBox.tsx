'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiUsers, FiArrowRight } from 'react-icons/fi'
import { normalizeJoinCode } from '@/lib/gameRoomV2/liveClassroom'
import { Bi } from '@/components/gameRoomV2/Bi'

// The student's way into a teacher's live game, shown at the TOP of the
// student GameRoom home (and on /gameroom-v2/live/join). Tamizhi card
// styling; Tamil first. Codes are case-insensitive and forgiving about
// spaces/dashes (normalizeJoinCode); the server remains the only judge
// of validity, enrollment and session state.
export function JoinLiveBox({ variant = 'banner' }: { variant?: 'banner' | 'card' }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<{ ta: string; en: string } | null>(null)
  const inputId = useId()
  const errorId = useId()

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const normalized = normalizeJoinCode(code)
    if (!normalized) return
    setJoining(true)
    setError(null)
    const res = await fetch('/api/gameroom-v2/live/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode: normalized }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res || !res.ok) {
      setJoining(false)
      const status = res?.status ?? 0
      setError(
        status === 404
          ? { ta: 'இந்தக் குறியீடு சரியில்லை. மீண்டும் சரிபார்க்கவும்.', en: "That code didn't work. Check it with your teacher." }
          : status === 409
            ? { ta: 'இந்த நேரலை விளையாட்டு ஏற்கனவே முடிந்துவிட்டது.', en: 'This live game has already ended.' }
            : status === 410
              ? { ta: 'இந்த அமர்வு பழையதாகிவிட்டது. புதிய குறியீட்டைக் கேளுங்கள்.', en: 'This session has expired. Ask your teacher for a new code.' }
              : status === 429
                ? { ta: 'சிறிது நேரம் கழித்து முயலுங்கள்.', en: 'Too many tries -- wait a moment.' }
                : { ta: 'சேர முடியவில்லை. மீண்டும் முயலுங்கள்.', en: data?.error || 'Could not join. Please try again.' }
      )
      return
    }
    router.push(`/gameroom-v2/live/play/${data.liveSessionId}`)
  }

  const banner = variant === 'banner'
  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className={`bg-white dark:bg-stone-900 rounded-2xl border ${banner ? 'border-primary-200 dark:border-primary-900' : 'border-stone-200 dark:border-stone-800'} p-4 sm:p-5 shadow-sm`}
    >
      <div className={`flex ${banner ? 'flex-col md:flex-row md:items-center' : 'flex-col'} gap-3 md:gap-5`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 flex items-center justify-center" aria-hidden>
            <FiUsers className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h2 id={`${inputId}-title`} className="text-lg font-bold text-primary-900 dark:text-white font-tamil leading-snug">
              நேரலை வகுப்பில் சேருங்கள்
            </h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Join your teacher&apos;s live game</p>
          </div>
        </div>
        <form onSubmit={handleJoin} className={`flex gap-2 ${banner ? 'md:ml-auto md:w-[26rem]' : ''} w-full`}>
          <label htmlFor={inputId} className="sr-only">
            சேர்வுக் குறியீடு · Join code
          </label>
          <input
            id={inputId}
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setError(null)
            }}
            placeholder="குறியீடு · CODE"
            maxLength={16}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            inputMode="text"
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="min-w-0 flex-1 min-h-[48px] px-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 text-lg font-bold tracking-[0.18em] uppercase text-stone-900 dark:text-white placeholder:tracking-normal placeholder:font-semibold placeholder:text-stone-400 placeholder:text-base focus:outline-none focus:ring-4 focus:ring-primary-300"
          />
          <button
            type="submit"
            disabled={joining || !code.trim()}
            className="shrink-0 min-h-[48px] px-5 rounded-xl bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-primary-300"
          >
            {joining ? <Bi k="joining" inline en={false} /> : <Bi k="join" inline />}
            <FiArrowRight className="w-4 h-4" aria-hidden />
          </button>
        </form>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm font-semibold text-terracotta-700 dark:text-terracotta-300">
          <span className="font-tamil">{error.ta}</span> <span className="font-normal text-stone-500 dark:text-stone-400">{error.en}</span>
        </p>
      )}
    </section>
  )
}
