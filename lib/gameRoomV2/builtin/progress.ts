import { BUILTIN_TOPICS, LEARNING_BOARDS, topicForSetId, getBuiltinTopic } from './catalog'
import type { LearningBoard } from './types'

// Learning Board progress and "what next" recommendations, derived ONLY
// from real gameplay records:
//   - sms_gamev2_question_set_completions (077): written by the reward
//     service when a session is COMPLETED and its rewards finalized --
//     opening a topic, or starting and abandoning a game, never counts.
//   - sms_gamev2_sessions (076): the student's own completed sessions,
//     for recent activity and before/after accuracy.
// Pure functions: the caller fetches rows under the student's own RLS.

export const MASTERY_ACCURACY_PCT = 80
const NEEDS_PRACTICE_BELOW_PCT = 60
const IMPROVEMENT_MIN_POINTS = 10

export interface CompletionRow {
  question_set_id: string
  completion_count: number
  best_accuracy_pct: number | string
  last_completed_at: string
}

export interface SessionRow {
  id: string
  question_set_id: string
  engine_id: string
  status: string
  correct_count: number
  answered_count: number
  xp_earned: number
  created_at: string
  completed_at: string | null
}

export type TopicStatus = 'new' | 'practicing' | 'mastered'

export interface TopicProgress {
  key: string
  status: TopicStatus
  bestAccuracy: number | null
  completions: number
  lastPracticedAt: string | null
}

export interface BoardProgress {
  boardId: string
  total: number
  mastered: number
  practicing: number
  percent: number
}

export interface Recommendation {
  topicKey: string
  kind: 'improved' | 'practice-again' | 'continue' | 'next'
  title: string
  reason: string
}

export interface RecentActivity {
  sessionId: string
  topicKey: string
  engineId: string
  accuracy: number
  xpEarned: number
  completedAt: string
}

function accuracyOf(s: SessionRow): number {
  return s.answered_count > 0 ? Math.round((s.correct_count / s.answered_count) * 100) : 0
}

export function computeTopicProgress(completions: CompletionRow[]): Map<string, TopicProgress> {
  const byTopic = new Map<string, TopicProgress>()
  for (const topic of BUILTIN_TOPICS) {
    byTopic.set(topic.key, { key: topic.key, status: 'new', bestAccuracy: null, completions: 0, lastPracticedAt: null })
  }
  for (const row of completions) {
    const topic = topicForSetId(row.question_set_id)
    if (!topic || row.completion_count <= 0) continue
    const p = byTopic.get(topic.key)!
    const best = Number(row.best_accuracy_pct)
    p.completions += row.completion_count
    p.bestAccuracy = p.bestAccuracy === null ? best : Math.max(p.bestAccuracy, best)
    if (!p.lastPracticedAt || row.last_completed_at > p.lastPracticedAt) p.lastPracticedAt = row.last_completed_at
  }
  byTopic.forEach((p) => {
    if (p.completions > 0) p.status = (p.bestAccuracy ?? 0) >= MASTERY_ACCURACY_PCT ? 'mastered' : 'practicing'
  })
  return byTopic
}

export function computeBoardProgress(board: LearningBoard, progress: Map<string, TopicProgress>): BoardProgress {
  const statuses = board.topicKeys.map((k) => progress.get(k)?.status ?? 'new')
  const mastered = statuses.filter((s) => s === 'mastered').length
  const practicing = statuses.filter((s) => s === 'practicing').length
  const total = board.topicKeys.length
  return { boardId: board.id, total, mastered, practicing, percent: total > 0 ? Math.round((mastered / total) * 100) : 0 }
}

// Completed built-in sessions, newest first.
export function recentBuiltinActivity(sessions: SessionRow[], limit = 8): RecentActivity[] {
  return sessions
    .filter((s) => s.status === 'COMPLETED' && s.completed_at && topicForSetId(s.question_set_id))
    .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1))
    .slice(0, limit)
    .map((s) => ({
      sessionId: s.id,
      topicKey: topicForSetId(s.question_set_id)!.key,
      engineId: s.engine_id,
      accuracy: accuracyOf(s),
      xpEarned: s.xp_earned,
      completedAt: s.completed_at!,
    }))
}

// Simple, deterministic rules -- no AI, no randomness:
//   1. "You improved in X": latest completed session on a topic beat the
//      previous one by >= 10 points.
//   2. "Practice X again": practiced but best accuracy < 60%.
//   3. "Continue X": practiced, 60-79% -- not yet mastered.
//   4. "Try X next": the next unstarted topic, on the board the student
//      last practiced (or Tamil Foundations for a brand-new student).
export function recommend(progress: Map<string, TopicProgress>, sessions: SessionRow[], max = 3): Recommendation[] {
  const recs: Recommendation[] = []
  const used = new Set<string>()
  const title = (key: string) => getBuiltinTopic(key)?.tamilTitle ?? key
  const push = (r: Recommendation) => {
    if (recs.length < max && !used.has(r.topicKey)) {
      recs.push(r)
      used.add(r.topicKey)
    }
  }

  const completed = sessions
    .filter((s) => s.status === 'COMPLETED' && s.completed_at && topicForSetId(s.question_set_id))
    .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1))

  // 1. Improvement on the most recently played topic that improved.
  const seenTopics = new Set<string>()
  for (const s of completed) {
    const key = topicForSetId(s.question_set_id)!.key
    if (seenTopics.has(key)) continue
    seenTopics.add(key)
    const onTopic = completed.filter((x) => topicForSetId(x.question_set_id)!.key === key)
    if (onTopic.length >= 2) {
      const gain = accuracyOf(onTopic[0]) - accuracyOf(onTopic[1])
      if (gain >= IMPROVEMENT_MIN_POINTS) {
        push({ topicKey: key, kind: 'improved', title: `You improved in ${title(key)}`, reason: `+${gain}% accuracy since your last game` })
        break
      }
    }
  }

  const practiced = Array.from(progress.values())
    .filter((p) => p.status === 'practicing')
    .sort((a, b) => ((b.lastPracticedAt ?? '') > (a.lastPracticedAt ?? '') ? 1 : -1))

  // 2. Needs practice.
  for (const p of practiced) {
    if ((p.bestAccuracy ?? 0) < NEEDS_PRACTICE_BELOW_PCT) {
      push({ topicKey: p.key, kind: 'practice-again', title: `Practice ${title(p.key)} again`, reason: `Best so far: ${Math.round(p.bestAccuracy ?? 0)}%` })
    }
  }
  // 3. Continue toward mastery.
  for (const p of practiced) {
    if ((p.bestAccuracy ?? 0) >= NEEDS_PRACTICE_BELOW_PCT) {
      push({
        topicKey: p.key,
        kind: 'continue',
        title: `Continue ${title(p.key)}`,
        reason: `${Math.round(p.bestAccuracy ?? 0)}% -- reach ${MASTERY_ACCURACY_PCT}% to master it`,
      })
    }
  }

  // 4. Next new topic.
  const lastKey = completed[0] ? topicForSetId(completed[0].question_set_id)!.key : null
  const boardOrder = lastKey
    ? [...LEARNING_BOARDS.filter((b) => b.topicKeys.includes(lastKey)), ...LEARNING_BOARDS.filter((b) => !b.topicKeys.includes(lastKey))]
    : LEARNING_BOARDS
  for (const board of boardOrder) {
    const next = board.topicKeys.find((k) => (progress.get(k)?.status ?? 'new') === 'new' && !used.has(k))
    if (next) {
      push({
        topicKey: next,
        kind: 'next',
        title: `Try ${title(next)} next`,
        reason: lastKey ? `Next on ${board.title}` : `A good place to start: ${board.title}`,
      })
      if (recs.length >= max) break
    }
  }

  return recs
}
