'use client'

import Link from 'next/link'
import { JoinLiveBox } from '@/components/gameRoomV2/liveClassroom/JoinLiveBox'
import { FiStar, FiTrendingUp, FiTarget, FiCheckCircle, FiBarChart2, FiArrowRight, FiPlayCircle, FiAward, FiCalendar } from 'react-icons/fi'
import { PageHeader, SectionCard, StatCard, ProgressBar, TopicStatusBadge, engineIcon, primaryLinkButton, secondaryLinkButton } from '@/components/gameRoomV2/shell/ui'
import { QuickPlay } from '@/components/gameRoomV2/learning/QuickPlay'
import { useStartGame } from '@/components/gameRoomV2/learning/useStartGame'
import type { TopicSummary } from '@/lib/gameRoomV2/builtin/summaries'
import type { StudentLearning } from '@/lib/gameRoomV2/builtin/studentLearning'
import type { LearningBoard } from '@/lib/gameRoomV2/builtin/types'

export interface HomeDailyChallenge {
  name: string
  description: string
  progress: number
  goal: number
  completed: boolean
}

// The student GameRoom home: a Tamil learning dashboard. Topic first
// ("what do I practise?"), game second ("how do I want to play?").
// Everything shown comes from the student's own gameplay records.
export function HomeScreenClient({
  firstName,
  level,
  learning,
  topics,
  boards,
  featuredTopicKeys,
  games,
  dailyChallenge,
  earnedAchievements,
  totalAchievements,
  teacherSets = [],
}: {
  firstName: string
  level: number
  learning: StudentLearning
  topics: TopicSummary[]
  boards: LearningBoard[]
  featuredTopicKeys: string[]
  games: { id: string; name: string; topicCount: number }[]
  dailyChallenge: HomeDailyChallenge | null
  earnedAchievements: { id: string; name: string }[]
  totalAchievements: number
  teacherSets?: { id: string; title: string; tamilTitle: string | null; questionCount: number; engines: { id: string; name: string }[] }[]
}) {
  const { start, starting } = useStartGame()
  const topicByKey = new Map(topics.map((t) => [t.key, t]))
  const statuses = Object.fromEntries(Object.entries(learning.topicProgress).map(([k, p]) => [k, p.status]))
  const lastActivity = learning.recentActivity[0]
  const lastTopic = lastActivity ? topicByKey.get(lastActivity.topicKey) : undefined

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Live Classroom first: a student arriving with a code from their
          teacher should never have to hunt for where to type it. */}
      <JoinLiveBox />
      <PageHeader
        title="Game Room"
        tamilTitle="விளையாட்டு அறை"
        description={`${firstName ? `Welcome, ${firstName}. ` : ''}Pick a Tamil topic, then choose a game to practise it.`}
        actions={
          <>
            <Link href="/gameroom-v2/trace" className={secondaryLinkButton}>
              <span aria-hidden>✍️</span> <span className="font-tamil">எழுதிப் பழகு</span> · Trace & Learn
            </Link>
            <Link href="/gameroom-v2/progress" className={secondaryLinkButton}>
              <FiBarChart2 className="w-4 h-4" aria-hidden /> My Progress
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiStar} value={`Level ${level}`} label={`${learning.stats.xp.toLocaleString()} XP`} />
        <StatCard icon={FiTrendingUp} value={learning.stats.dailyStreak} label="Day streak" />
        <StatCard icon={FiCheckCircle} value={`${learning.topicsMastered}/${topics.length}`} label="Topics mastered" />
        <StatCard icon={FiTarget} value={learning.overallAccuracy === null ? '--' : `${learning.overallAccuracy}%`} label="Recent accuracy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Recommended for You">
          <ul className="space-y-3">
            {learning.recommendations.map((r) => {
              const topic = topicByKey.get(r.topicKey)
              const game = topic?.engines[0]
              return (
                <li key={r.topicKey} className="flex items-center justify-between gap-3">
                  <Link href={`/gameroom-v2/topics/${r.topicKey}`} className="min-w-0 group">
                    <p className="font-medium font-tamil leading-relaxed text-stone-800 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400 break-words">{r.title}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{r.reason}</p>
                  </Link>
                  {game && (
                    <button
                      type="button"
                      disabled={starting !== null}
                      onClick={() => start(game.setId, game.engineId, `rec:${r.topicKey}`)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-primary-700 hover:bg-primary-800 dark:bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
                      aria-label={`Play ${topic?.tamilTitle} now`}
                    >
                      <FiPlayCircle className="w-4 h-4" aria-hidden /> {starting === `rec:${r.topicKey}` ? '...' : 'Play'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-4">Based on your recent games and scores.</p>
        </SectionCard>

        <SectionCard title="Continue Learning">
          {learning.inProgress.length === 0 && !lastTopic ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Nothing in progress yet. Start with a Learning Board below -- your games will show up here.
            </p>
          ) : (
            <ul className="space-y-3">
              {learning.inProgress.map((s) => {
                const Icon = engineIcon(s.engineId)
                const topic = topics.find((t) => t.engines.some((e) => e.setId === s.questionSetId))
                return (
                  <li key={s.id}>
                    <Link href={`/gameroom-v2/play/${s.id}`} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60">
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="w-5 h-5 text-primary-700 dark:text-primary-400 flex-shrink-0" aria-hidden />
                        <span className="min-w-0">
                          <span className="block font-medium font-tamil leading-relaxed text-stone-800 dark:text-stone-100 truncate">{topic?.tamilTitle ?? 'Your game'}</span>
                          <span className="block text-sm text-stone-500 dark:text-stone-400">
                            Resume -- {s.answered}/{s.total} answered
                          </span>
                        </span>
                      </span>
                      <FiArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" aria-hidden />
                    </Link>
                  </li>
                )
              })}
              {lastTopic && (
                <li>
                  <Link href={`/gameroom-v2/topics/${lastTopic.key}`} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/60">
                    <span className="min-w-0">
                      <span className="block font-medium font-tamil leading-relaxed text-stone-800 dark:text-stone-100 truncate">{lastTopic.tamilTitle}</span>
                      <span className="block text-sm text-stone-500 dark:text-stone-400">Last played -- {lastActivity!.accuracy}% accuracy</span>
                    </span>
                    <TopicStatusBadge status={statuses[lastTopic.key] ?? 'new'} />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Learning Boards" action={{ href: '/gameroom-v2/boards', label: 'View all' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {boards.map((b) => {
            const p = learning.boardProgress.find((x) => x.boardId === b.id)!
            return (
              <Link
                key={b.id}
                href={`/gameroom-v2/boards/${b.id}`}
                className="flex flex-col p-4 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
              >
                <p className="font-semibold text-stone-800 dark:text-stone-100">{b.title}</p>
                <p className="font-tamil text-sm leading-relaxed text-stone-500 dark:text-stone-400">{b.tamilTitle}</p>
                <div className="mt-3">
                  <ProgressBar percent={p.percent} label={`${b.title} progress`} />
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
                  {p.mastered}/{p.total} mastered{p.practicing > 0 ? ` · ${p.practicing} in progress` : ''}
                </p>
              </Link>
            )
          })}
        </div>
      </SectionCard>

      {teacherSets.length > 0 && (
        <SectionCard title="From Your Teachers">
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {teacherSets.map((set) => (
              <li key={set.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-tamil font-medium leading-relaxed text-stone-800 dark:text-stone-100 break-words">{set.tamilTitle || set.title}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{set.questionCount} questions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {set.engines.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      disabled={starting !== null}
                      onClick={() => start(set.id, e.id, `t:${set.id}:${e.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
                    >
                      <FiPlayCircle className="w-4 h-4" aria-hidden /> {starting === `t:${set.id}:${e.id}` ? 'Starting...' : e.name}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Quick Play">
        <QuickPlay topics={topics} statuses={statuses} />
      </SectionCard>

      <SectionCard title="Popular Topics" action={{ href: '/gameroom-v2/topics', label: 'All topics' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featuredTopicKeys.map((key) => {
            const t = topicByKey.get(key)
            if (!t) return null
            return (
              <Link
                key={key}
                href={`/gameroom-v2/topics/${key}`}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block font-tamil font-semibold leading-relaxed text-stone-800 dark:text-stone-100 truncate">{t.tamilTitle}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">{t.englishTitle}</span>
                </span>
                <TopicStatusBadge status={statuses[key] ?? 'new'} />
              </Link>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Games">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {games.map((g) => {
              const Icon = engineIcon(g.id)
              return (
                <Link
                  key={g.id}
                  href={`/gameroom-v2/topics?game=${g.id}`}
                  className="flex items-center gap-2 p-2.5 min-h-[44px] rounded-lg border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-sm font-medium text-stone-700 dark:text-stone-200"
                >
                  <Icon className="w-4 h-4 text-primary-700 dark:text-primary-400 flex-shrink-0" aria-hidden />
                  <span className="truncate">{g.name}</span>
                </Link>
              )
            })}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-3">Pick a game to see the topics you can play with it.</p>
        </SectionCard>

        <div className="space-y-6">
          {dailyChallenge && (
            <SectionCard title="Daily Challenge">
              <div className="flex items-start gap-3">
                <FiCalendar className="w-5 h-5 text-primary-700 dark:text-primary-400 mt-0.5 flex-shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-800 dark:text-stone-100">{dailyChallenge.name}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{dailyChallenge.description}</p>
                  <div className="mt-3">
                    <ProgressBar percent={(dailyChallenge.progress / dailyChallenge.goal) * 100} label="Daily challenge progress" />
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
                    {dailyChallenge.completed ? 'Completed today' : `${Math.min(dailyChallenge.progress, dailyChallenge.goal)}/${dailyChallenge.goal}`}
                  </p>
                </div>
              </div>
            </SectionCard>
          )}
          <SectionCard title="Achievements" action={{ href: '/gameroom-v2/progress', label: 'View all' }}>
            <div className="flex items-center gap-3">
              <FiAward className="w-5 h-5 text-gold-600 dark:text-gold-400 flex-shrink-0" aria-hidden />
              <p className="text-sm text-stone-600 dark:text-stone-300">
                {earnedAchievements.length} of {totalAchievements} earned
                {earnedAchievements.length > 0 ? ` -- latest: ${earnedAchievements[0].name}` : ' -- finish a game to earn your first.'}
              </p>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="flex justify-center">
        <Link href="/gameroom-v2/topics" className={primaryLinkButton}>
          Browse all Tamil topics <FiArrowRight className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    </div>
  )
}
