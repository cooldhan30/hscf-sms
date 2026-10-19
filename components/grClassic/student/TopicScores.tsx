'use client'

import Link from 'next/link'
import { formatDate } from '@/lib/grClassic/format'
import { starsFor } from '@/lib/grClassic/scoring'
import type { TopicScore } from '@/lib/grClassic/topicPlay'
import { Card, ProgressBar, SectionTitle } from '../ui'

// The student's own dashboard: how they are doing in each topic they have
// played in Play Offline. Practice only -- just for them, never a grade.
export function TopicScores({ scores }: { scores: TopicScore[] }) {
  const answered = scores.reduce((n, s) => n + s.answered, 0)
  const correct = scores.reduce((n, s) => n + s.correct, 0)
  return (
    <section aria-labelledby="grc-my-topics">
      <SectionTitle
        action={
          scores.length > 0 && (
            <Link href="/gr-classic/student/topics" className="text-sm font-bold text-rose-700 hover:underline">
              Play more
            </Link>
          )
        }
      >
        <span id="grc-my-topics">My scores by topic</span>
      </SectionTitle>

      {scores.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-slate-300 p-8 text-center font-bold text-slate-500">
          Play a topic in{' '}
          <Link href="/gr-classic/student/topics" className="text-rose-700 underline underline-offset-2">
            Play Offline
          </Link>{' '}
          and your scores will show here.
        </p>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-3 gap-3">
            <Stat label="Topics played" value={String(scores.length)} />
            <Stat label="Questions answered" value={String(answered)} />
            <Stat label="Right overall" value={`${answered ? Math.round((100 * correct) / answered) : 0}%`} />
          </dl>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Scores by topic">
            {scores.map((s) => {
              const accuracy = s.answered ? Math.round((100 * s.correct) / s.answered) : 0
              const stars = starsFor(s.bestPercent)
              return (
                <li key={s.topic}>
                  <Card className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-extrabold leading-snug text-slate-900">{s.name}</p>
                      <span className="shrink-0 text-lg" aria-label={`${stars} of 3 stars`}>
                        {[0, 1, 2].map((i) => (
                          <span key={i} aria-hidden className={i < stars ? '' : 'opacity-20 grayscale'}>
                            ⭐
                          </span>
                        ))}
                      </span>
                    </div>
                    <div className="flex items-end gap-4">
                      <p>
                        <span className="block text-3xl font-black tabular-nums text-rose-600">{s.bestPercent}%</span>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Best</span>
                      </p>
                      <p>
                        <span className="block text-xl font-extrabold tabular-nums text-slate-700">{s.lastPercent}%</span>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Last time</span>
                      </p>
                    </div>
                    <div>
                      <ProgressBar value={accuracy} max={100} label={`${s.name}: ${accuracy}% right overall`} />
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {s.correct} of {s.answered} right · played {s.plays} {s.plays === 1 ? 'time' : 'times'} · {formatDate(s.lastPlayedAt)}
                      </p>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="text-2xl font-black tabular-nums text-slate-900">{value}</dd>
    </div>
  )
}
