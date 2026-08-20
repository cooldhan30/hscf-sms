'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FiExternalLink, FiInfo } from 'react-icons/fi'
import { Modal } from '@/components/dashboard/Modal'

// Pulled from https://tamiltheni.org/competition/ -- kept here as data
// (not fetched at runtime) so the rules card never depends on that site
// being up. Full detail (eligibility, technical requirements, conduct
// rules) stays on the source page, linked at the bottom of each modal.
const THENI_RULES_URL = 'https://tamiltheni.org/competition/'

const LEVEL_RULES: Record<number, { ageLimit: string; format: string; time: string; rounds: string; scoring: string; tiebreaker: string }> = {
  1: {
    ageLimit: 'Ages up to 8',
    format: 'Name Tamil words based on pictures shown.',
    time: '8 seconds per question',
    rounds: 'Two rounds, five questions each',
    scoring: 'One point per correct answer',
    tiebreaker: 'One additional question for tied teams',
  },
  2: {
    ageLimit: 'Ages up to 10',
    format: 'Form a sentence using the pictures provided.',
    time: '20 seconds per question',
    rounds: 'Two rounds, five questions each',
    scoring: 'One point per correct answer',
    tiebreaker: 'Additional questions until one team scores higher',
  },
  3: {
    ageLimit: 'Ages up to 12',
    format: 'Translate English sentences to Tamil, spoken aloud.',
    time: '15 seconds per question',
    rounds: 'Two rounds, five questions each',
    scoring: 'One point per correct answer; judges determine translation accuracy',
    tiebreaker: 'One additional question for tied teams',
  },
  4: {
    ageLimit: 'Ages up to 16',
    format: 'Translate English sentences to Tamil and write them without errors.',
    time: '40 seconds per question',
    rounds: 'Two rounds, five questions each',
    scoring: 'One point per correct answer; judges assess accuracy',
    tiebreaker: 'One additional question for teams with identical high scores',
  },
  5: {
    ageLimit: 'Ages up to 16',
    format: 'Find the Tamil word using clue words, in a letter-pattern format.',
    time: '60 seconds to find five words per turn',
    rounds: 'Typically five rounds',
    scoring: 'One point per correct word; judges evaluate proper clue usage',
    tiebreaker: 'Additional rounds, or a bonus sentence-formation task',
  },
}

interface Level {
  id: string
  level_number: number
  name_tamil: string
  name_english: string | null
  sort_order: number
}

interface Enrollment {
  id: string
  xp: number
  current_streak_days: number
  longest_streak_days: number
  level_id: string | null
  season: { id: string; name: string } | null
  level: { id: string; level_number: number; name_tamil: string; name_english: string | null } | null
}

function rankForXp(xp: number): { emoji: string; label: string } {
  if (xp >= 5000) return { emoji: '🥇', label: 'Gold Bee' }
  if (xp >= 2000) return { emoji: '🥈', label: 'Silver Bee' }
  if (xp >= 500) return { emoji: '🥉', label: 'Bronze Bee' }
  return { emoji: '🐝', label: 'Busy Bee' }
}

// Phase 1 dashboard: shows real enrollment/XP/streak state and the level
// map, but the "Continue Learning" CTA only goes live for Theni 1 (the
// first playable game built in this pass) -- other levels show a
// "Coming soon" state rather than a dead link, matching the spec's
// phased build-out (Theni 2-5 land in later phases).
export function TheniDashboardClient({
  studentName,
  enrollment,
  levels,
  wordsExposed,
  wordsMastered,
  totalWords,
}: {
  studentName: string
  enrollment: Enrollment
  levels: Level[]
  wordsExposed: number
  wordsMastered: number
  totalWords: number
}) {
  const rank = rankForXp(enrollment.xp)
  const progressPct = totalWords > 0 ? Math.round((wordsMastered / totalWords) * 100) : 0
  const [rulesLevel, setRulesLevel] = useState<Level | null>(null)
  const openRules = LEVEL_RULES[rulesLevel?.level_number ?? -1]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">வணக்கம், {studentName}! 🐝</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">{enrollment.season?.name} — Your Tamil Theni Journey</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
          <p className="text-2xl">{rank.emoji}</p>
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 mt-1">{rank.label}</p>
        </div>
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
          <p className="text-2xl font-bold text-gold-600 dark:text-gold-400">⭐ {enrollment.xp}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">XP</p>
        </div>
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
          <p className="text-2xl font-bold text-terracotta-600 dark:text-terracotta-400">🔥 {enrollment.current_streak_days}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Day Streak</p>
        </div>
        <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-center">
          <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">{wordsMastered}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Words Mastered</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Overall Progress</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {wordsMastered} / {totalWords} words
          </p>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800">
          <div className="h-full bg-gradient-to-r from-primary-500 to-gold-500" style={{ width: `${progressPct}%` }} />
        </div>
        {wordsExposed > wordsMastered && (
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-2">
            {wordsExposed - wordsMastered} more {wordsExposed - wordsMastered === 1 ? 'word is' : 'words are'} in progress.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-3">Your Journey</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {levels.map((level) => {
            const isTheni1 = level.level_number === 1
            const isCurrent = enrollment.level_id === level.id

            return (
              <div
                key={level.id}
                className={`p-5 rounded-2xl border bg-white dark:bg-stone-900 ${
                  isCurrent ? 'border-primary-400 dark:border-primary-600' : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase">Theni {level.level_number}</p>
                    <p className="font-bold text-stone-800 dark:text-stone-100 mt-0.5">{level.name_tamil}</p>
                    {level.name_english && <p className="text-xs text-stone-500 dark:text-stone-400">{level.name_english}</p>}
                  </div>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-950/40 text-primary-800 dark:text-primary-300">
                      Current
                    </span>
                  )}
                </div>

                {LEVEL_RULES[level.level_number] && (
                  <button
                    onClick={() => setRulesLevel(level)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400"
                  >
                    <FiInfo className="w-3.5 h-3.5" /> Competition Rules
                  </button>
                )}

                {isTheni1 ? (
                  <Link
                    href="/student/theni/learn"
                    className="mt-4 inline-flex items-center justify-center w-full px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
                  >
                    ▶ Continue Your Quest
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-stone-400 dark:text-stone-500 text-center py-2">Coming soon</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={rulesLevel !== null}
        title={rulesLevel ? `Theni ${rulesLevel.level_number} — ${rulesLevel.name_tamil} Rules` : ''}
        onClose={() => setRulesLevel(null)}
      >
        {openRules && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">{openRules.ageLimit}</p>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-stone-700 dark:text-stone-300">Format</dt>
                <dd className="text-stone-600 dark:text-stone-300 mt-0.5">{openRules.format}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700 dark:text-stone-300">Time</dt>
                <dd className="text-stone-600 dark:text-stone-300 mt-0.5">{openRules.time}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700 dark:text-stone-300">Rounds</dt>
                <dd className="text-stone-600 dark:text-stone-300 mt-0.5">{openRules.rounds}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700 dark:text-stone-300">Scoring</dt>
                <dd className="text-stone-600 dark:text-stone-300 mt-0.5">{openRules.scoring}</dd>
              </div>
              <div>
                <dt className="font-semibold text-stone-700 dark:text-stone-300">Tie-breaker</dt>
                <dd className="text-stone-600 dark:text-stone-300 mt-0.5">{openRules.tiebreaker}</dd>
              </div>
            </dl>
            <a
              href={THENI_RULES_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:underline"
            >
              Full competition rules <FiExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
