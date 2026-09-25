'use client'

import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { useEffect, useState } from 'react'
import { FiUsers, FiTarget, FiTrendingUp, FiAlertCircle } from 'react-icons/fi'
import { GameV2Card, GameV2Empty, GameV2Loading, GameV2ProgressBar } from '@/components/gameRoomV2'
import { getConceptSuggestionByTamilName } from '@/lib/gameRoomV2/analytics'

interface QuestionSetOption {
  id: string
  title: string
  tamilTitle: string | null
  questionCount: number
}

interface DimensionMastery {
  key: string
  label: string
  tamilLabel: string
  correctCount: number
  totalCount: number
  accuracyPct: number
}

interface ConceptMastery {
  key: string
  correctCount: number
  totalCount: number
  accuracyPct: number
}

interface StudentNeedingPractice {
  studentId: string
  studentName: string
  accuracyPct: number
  correctCount: number
  totalCount: number
}

interface ConceptNeedingAttention {
  concept: string
  classAccuracyPct: number
  totalAttempts: number
  studentsNeedingPractice: StudentNeedingPractice[]
}

interface CommonMistake {
  pairKey: string
  studentIds: string[]
  occurrenceCount: number
}

interface AnalyticsReport {
  totalAnswers: number
  classAccuracyPct: number
  dimensionMastery: DimensionMastery[]
  conceptMastery: ConceptMastery[]
  conceptsNeedingAttention: ConceptNeedingAttention[]
  commonMistakes: CommonMistake[]
  improvement: { earlierAccuracyPct: number; laterAccuracyPct: number; deltaPct: number; earlierCount: number; laterCount: number } | null
}

// The teacher-facing learning analytics report for ONE Question Set --
// class accuracy, dimension/concept mastery, students needing practice,
// common mistakes, and improvement over time. All numbers here come
// straight from GET /api/gameroom-v2/analytics/teacher, which computes
// them via the same pure, tested functions as
// scripts/verify-gameroom-v2-learning-analytics.ts -- nothing is
// recomputed or approximated client-side.
export function AnalyticsClient({ questionSets }: { questionSets: QuestionSetOption[] }) {
  const [selectedSetId, setSelectedSetId] = useState<string | null>(questionSets[0]?.id ?? null)
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedSetId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/gameroom-v2/analytics/teacher?questionSetId=${selectedSetId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setError(data.error)
          return
        }
        setReport(data)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load analytics')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedSetId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Analytics"
        description="Educational performance on your question sets, tracked separately from game scores."
        backHref="/gameroom-v2"
        backLabel="Game Room"
      />

      {questionSets.length === 0 ? (
        <GameV2Card>
          <GameV2Empty title="No question sets yet" description="Create a question set in the Builder to see analytics here once students have played it." />
        </GameV2Card>
      ) : (
        <>
          <select
            value={selectedSetId ?? ''}
            onChange={(e) => setSelectedSetId(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 font-bold"
          >
            {questionSets.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} {s.tamilTitle ? `(${s.tamilTitle})` : ''} -- {s.questionCount} questions
              </option>
            ))}
          </select>

          {loading && <GameV2Loading label="Loading analytics..." />}
          {error && (
            <GameV2Card>
              <GameV2Empty icon={FiAlertCircle} title="Couldn't load analytics" description={error} />
            </GameV2Card>
          )}

          {!loading && !error && report && (
            <div className="space-y-6">
              {report.totalAnswers === 0 ? (
                <GameV2Card>
                  <GameV2Empty title="No attempts yet" description="Once students play this question set, their learning analytics will show up here." />
                </GameV2Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <StatCard icon={FiUsers} label="Class Accuracy" value={`${report.classAccuracyPct}%`} />
                    <StatCard icon={FiTarget} label="Questions Answered" value={String(report.totalAnswers)} />
                    {report.improvement && (
                      <StatCard
                        icon={FiTrendingUp}
                        label="Improvement"
                        value={`${report.improvement.deltaPct > 0 ? '+' : ''}${report.improvement.deltaPct}%`}
                      />
                    )}
                  </div>

                  {report.dimensionMastery.length > 0 && (
                    <GameV2Card>
                      <h2 className="font-bold text-primary-900 dark:text-white mb-4">Mastery by Dimension</h2>
                      <div className="space-y-4">
                        {report.dimensionMastery.map((d) => (
                          <div key={d.key}>
                            <GameV2ProgressBar
                              value={d.accuracyPct}
                              max={100}
                              label={`${d.label} (${d.tamilLabel}) -- ${d.correctCount}/${d.totalCount} correct`}
                              tone="mint"
                            />
                          </div>
                        ))}
                      </div>
                    </GameV2Card>
                  )}

                  {report.conceptMastery.length > 0 && (
                    <GameV2Card>
                      <h2 className="font-bold text-primary-900 dark:text-white mb-4">Topic Mastery</h2>
                      <div className="space-y-4">
                        {report.conceptMastery.map((c) => (
                          <div key={c.key}>
                            <GameV2ProgressBar
                              value={c.accuracyPct}
                              max={100}
                              label={`${c.key} -- ${c.correctCount}/${c.totalCount} correct`}
                              tone="spark"
                            />
                          </div>
                        ))}
                      </div>
                    </GameV2Card>
                  )}

                  {report.conceptsNeedingAttention.length > 0 && (
                    <GameV2Card>
                      <h2 className="font-bold text-primary-900 dark:text-white mb-1">Students Needing Practice</h2>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
                        Below 70% accuracy, with at least 3 attempts on the concept.
                      </p>
                      <div className="space-y-5">
                        {report.conceptsNeedingAttention.map((c) => {
                          const gloss = getConceptSuggestionByTamilName(c.concept)
                          return (
                            <div key={c.concept}>
                              <p className="font-bold text-sm text-stone-800 dark:text-stone-100 font-tamil leading-relaxed">
                                {c.concept} {gloss ? <span className="text-stone-400 font-normal">({gloss.englishName})</span> : null}
                              </p>
                              <ul className="mt-2 space-y-1.5">
                                {c.studentsNeedingPractice.map((s) => (
                                  <li key={s.studentId} className="flex items-center justify-between text-sm">
                                    <span className="text-stone-700 dark:text-stone-200">{s.studentName}</span>
                                    <span className="text-red-600 dark:text-red-400 font-bold tabular-nums">
                                      {s.accuracyPct}% ({s.correctCount}/{s.totalCount})
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                        })}
                      </div>
                    </GameV2Card>
                  )}

                  {report.commonMistakes.length > 0 && (
                    <GameV2Card>
                      <h2 className="font-bold text-primary-900 dark:text-white mb-1">Common Mistakes</h2>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">
                        Confusions shared by 3 or more students.
                      </p>
                      <ul className="space-y-2">
                        {report.commonMistakes.map((m) => (
                          <li key={m.pairKey} className="flex items-center justify-between text-sm rounded-xl bg-stone-50 dark:bg-stone-800/50 p-3">
                            <span className="font-tamil leading-relaxed font-bold text-stone-800 dark:text-stone-100">{m.pairKey}</span>
                            <span className="text-stone-500 dark:text-stone-400">
                              {m.studentIds.length} students, {m.occurrenceCount} times
                            </span>
                          </li>
                        ))}
                      </ul>
                    </GameV2Card>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof FiUsers; label: string; value: string }) {
  return (
    <GameV2Card padding="sm" className="text-center">
      <Icon className="w-5 h-5 mx-auto text-primary-600 dark:text-primary-400 mb-2" />
      <p className="text-2xl font-bold text-primary-900 dark:text-white tabular-nums">{value}</p>
      <p className="text-xs font-bold text-stone-400 dark:text-stone-500 mt-0.5">{label}</p>
    </GameV2Card>
  )
}
