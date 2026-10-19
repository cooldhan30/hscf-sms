'use client'

import type { PlayQuestion } from '@/lib/grClassic/play'
import { totals } from '@/lib/grClassic/scoring'
import type { GameType } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'
import { grcApi } from '../teacher/api'

// A student practising one of their teachers' games. Answers and hints are
// checked by the server (/api/gr-classic/practice/<id>/...), which shows the
// right answer straight away -- it's practice. When a round ends, the score
// is saved as practice progress (never a grade).
export function PracticeRunner({ gameId, title, type, questions }: { gameId: string; title: string; type: GameType; questions: PlayQuestion[] }) {
  return (
    <GamePlayer
      game={{ title, type }}
      play={{ source: 'remote', base: `/practice/${gameId}`, questions }}
      mode="practice"
      exit={{ href: '/gr-classic/student' }}
      onFinished={(results) => {
        // Best effort: a lost progress update never interrupts the child.
        grcApi(`/practice/${gameId}/finish`, { method: 'POST', body: { percent: totals(results).percent } })
      }}
    />
  )
}
