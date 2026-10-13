'use client'

import { useEffect, useState } from 'react'
import type { PlayQuestion } from '@/lib/grClassic/play'
import type { GameType, SubmitSummary } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { grcApi } from '../teacher/api'
import { ButtonLink, Card, Shell } from '../ui'

interface Started {
  attemptId: string
  title: string
  type: GameType
  questions: PlayQuestion[]
  answeredIds: string[]
  deadlineAt: string | null
}

// A student playing an assignment for real. Starting (or resuming) and
// submitting both go to the server; answers are checked and stored one
// by one at /api/gr-classic/attempts/<id>/check, so closing the tab
// loses nothing.
export function AssignmentRunner({ assignmentId }: { assignmentId: string }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; started: Started }>({ kind: 'loading' })
  const [run, setRun] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    grcApi<Started>(`/assignments/${assignmentId}/start`, { method: 'POST' }).then((res) => {
      if (cancelled) return
      setState(res.ok ? { kind: 'ready', started: res.data } : { kind: 'error', message: res.error })
    })
    return () => {
      cancelled = true
    }
  }, [assignmentId, run])

  if (state.kind === 'loading') {
    return (
      <Shell width="max-w-xl">
        <p role="status" className="mt-16 animate-pulse text-center text-lg font-bold text-slate-600">
          Getting your assignment ready…
        </p>
      </Shell>
    )
  }
  if (state.kind === 'error') {
    return (
      <Shell back={{ href: '/gr-classic/student/assignments', label: 'My Assignments' }} width="max-w-xl">
        <Card className="mt-6 p-8 text-center">
          <p className="text-5xl" aria-hidden>
            📭
          </p>
          <h1 className="mt-3 text-2xl font-black text-slate-900">You can’t start this one right now</h1>
          <p className="mt-2 font-semibold text-slate-600">{state.message}</p>
          <ButtonLink href="/gr-classic/student/assignments" tone="plain" className="mt-6">
            Back to My Assignments
          </ButtonLink>
        </Card>
      </Shell>
    )
  }

  const s = state.started
  const submit = async (): Promise<SubmitSummary> => {
    const res = await grcApi<SubmitSummary>(`/attempts/${s.attemptId}/submit`, { method: 'POST' })
    if (!res.ok) throw new Error(res.error)
    return res.data
  }
  return (
    <GamePlayer
      key={s.attemptId}
      game={{ title: s.title, type: s.type }}
      play={{ source: 'remote', base: `/attempts/${s.attemptId}`, questions: s.questions }}
      mode="assignment"
      assignment={{ answeredIds: s.answeredIds, deadlineAt: s.deadlineAt, submit, onRetry: () => setRun((n) => n + 1) }}
      exit={{ href: '/gr-classic/student/assignments' }}
    />
  )
}
