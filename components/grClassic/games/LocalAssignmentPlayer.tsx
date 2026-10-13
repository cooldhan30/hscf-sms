'use client'

import { totals } from '@/lib/grClassic/scoring'
import type { Game, QuestionResult, SubmitSummary } from '@/lib/grClassic/types'
import { GamePlayer } from './GamePlayer'

// The Phase 1 sample assignments (no database): grades in the browser.
// Real assignments use components/grClassic/student/AssignmentRunner.
export function LocalAssignmentPlayer({ game, attemptsLeftAfter, randomize, exitHref }: { game: Game; attemptsLeftAfter: number | null; randomize: boolean; exitHref: string }) {
  const submit = async (results: QuestionResult[]): Promise<SubmitSummary> => {
    await new Promise((r) => setTimeout(r, 500))
    const t = totals(results)
    return { submittedAt: new Date().toISOString(), percent: t.percent, correct: t.correct, total: t.total, attemptsLeft: attemptsLeftAfter, late: false, answersNote: 'Sample assignment — nothing was saved.' }
  }
  return <GamePlayer game={game} play={{ source: 'local', questions: game.questions }} mode="assignment" assignment={{ randomize, submit }} exit={{ href: exitHref }} />
}
