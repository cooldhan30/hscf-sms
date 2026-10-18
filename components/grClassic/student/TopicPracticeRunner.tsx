'use client'

import type { PlayQuestion } from '@/lib/grClassic/play'
import type { GameType } from '@/lib/grClassic/types'
import { GamePlayer } from '../games/GamePlayer'

// A student playing a topic of the question library on their own, with a
// countdown per question. Answers are checked by the server
// (/api/gr-classic/practice/topic/...), which shows the right answer
// straight away -- it's practice, and nothing is stored.
export function TopicPracticeRunner({ title, type, seconds, questions }: { title: string; type: GameType; seconds: number; questions: PlayQuestion[] }) {
  return <GamePlayer game={{ title, type, secondsPerQuestion: seconds }} play={{ source: 'remote', base: '/practice/topic', questions }} mode="practice" exit={{ href: '/gr-classic/student/topics' }} />
}
