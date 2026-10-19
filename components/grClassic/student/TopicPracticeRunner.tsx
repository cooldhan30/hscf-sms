'use client'

import type { PlayQuestion } from '@/lib/grClassic/play'
import type { GameType } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { grcApi } from '../teacher/api'

// A student playing topics of the question library on their own (Play
// Offline), with a countdown per question. Answers are checked by the
// server (/api/gr-classic/practice/topic/...), which shows the right
// answer straight away -- it's practice. When a round ends, the score is
// added to the student's scores per topic (their home page dashboard).
export function TopicPracticeRunner({ title, type, seconds, questions }: { title: string; type: GameType; seconds: number; questions: PlayQuestion[] }) {
  return (
    <GamePlayer
      game={{ title, type, secondsPerQuestion: seconds }}
      play={{ source: 'remote', base: '/practice/topic', questions }}
      mode="practice"
      exit={{ href: '/gr-classic/student' }}
      onFinished={(results) => {
        // Best effort: a lost update never interrupts the child.
        grcApi('/practice/topic/finish', { method: 'POST', body: { results: results.map((r) => ({ questionId: r.questionId, correct: r.correctUnits, total: r.totalUnits })) } })
      }}
    />
  )
}
