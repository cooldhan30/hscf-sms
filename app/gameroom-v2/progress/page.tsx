import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiStar, FiTrendingUp, FiCheckCircle, FiTarget } from 'react-icons/fi'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, SectionCard, StatCard, ProgressBar, TopicStatusBadge, engineIcon } from '@/components/gameRoomV2/shell/ui'
import { GameV2Badge } from '@/components/gameRoomV2/GameV2Badge'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { LEARNING_BOARDS, getBuiltinTopic } from '@/lib/gameRoomV2/builtin/catalog'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { ACHIEVEMENTS } from '@/lib/gameRoomV2/progression/achievements'
import { levelForXp } from '@/lib/gameRoomV2/progression'
import { formatDateOnly } from '@/lib/dates'

export const dynamic = 'force-dynamic'

// "How am I improving?" -- a student's own GameRoom progress, all from
// real gameplay records (never from merely opening a topic).
export default async function StudentProgressPage() {
  const ctx = await loadGameRoomPage('/gameroom-v2/progress')
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }
  if (ctx.role !== 'student' || !ctx.learning) notFound()

  const learning = ctx.learning
  const { level, xpIntoCurrentLevel, xpNeededForNextLevel } = levelForXp(learning.stats.xp)
  const practiced = Object.values(learning.topicProgress)
    .filter((p) => p.status !== 'new')
    .sort((a, b) => ((b.lastPracticedAt ?? '') > (a.lastPracticedAt ?? '') ? 1 : -1))
  const earned = new Set(learning.achievementIds.map((a) => a.id))

  return (
    <GameRoomShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader title="My Progress" tamilTitle="என் முன்னேற்றம்" description="Topics you've practised, how accurate you are, and what you've earned." backHref="/gameroom-v2" backLabel="Game Room" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FiStar} value={`Level ${level}`} label={`${learning.stats.xp.toLocaleString()} XP`} />
          <StatCard icon={FiTrendingUp} value={learning.stats.dailyStreak} label={`Day streak (best ${learning.stats.longestStreak})`} />
          <StatCard icon={FiCheckCircle} value={`${learning.topicsMastered} / ${learning.topicsPracticed}`} label="Topics mastered / practised" />
          <StatCard icon={FiTarget} value={learning.overallAccuracy === null ? '--' : `${learning.overallAccuracy}%`} label="Accuracy (recent games)" />
        </div>

        <SectionCard title="Next level">
          <ProgressBar percent={(xpIntoCurrentLevel / Math.max(1, xpNeededForNextLevel)) * 100} label="XP toward next level" />
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">
            {xpIntoCurrentLevel}/{xpNeededForNextLevel} XP to Level {level + 1} · {learning.stats.gamesCompleted} games finished · {learning.stats.correctAnswers} correct answers
          </p>
        </SectionCard>

        <SectionCard title="Learning Boards">
          <ul className="space-y-4">
            {LEARNING_BOARDS.map((b) => {
              const p = learning.boardProgress.find((x) => x.boardId === b.id)!
              return (
                <li key={b.id}>
                  <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
                    <Link href={`/gameroom-v2/boards/${b.id}`} className="font-medium text-stone-800 dark:text-stone-100 hover:text-primary-700 dark:hover:text-primary-400">
                      {b.title} <span className="font-tamil leading-relaxed text-stone-500 dark:text-stone-400">· {b.tamilTitle}</span>
                    </Link>
                    <span className="text-stone-500 dark:text-stone-400 flex-shrink-0">
                      {p.mastered}/{p.total}
                    </span>
                  </div>
                  <ProgressBar percent={p.percent} label={`${b.title} progress`} />
                </li>
              )
            })}
          </ul>
        </SectionCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard title="Topics practised">
            {practiced.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Finish a game on any topic and it will appear here.</p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {practiced.map((p) => {
                  const t = getBuiltinTopic(p.key)
                  return (
                    <li key={p.key}>
                      <Link href={`/gameroom-v2/topics/${p.key}`} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="min-w-0">
                          <span className="block font-tamil font-medium leading-relaxed text-stone-800 dark:text-stone-100 truncate">{t?.tamilTitle}</span>
                          <span className="block text-xs text-stone-500 dark:text-stone-400">
                            Best {Math.round(p.bestAccuracy ?? 0)}% · {p.completions} game{p.completions === 1 ? '' : 's'}
                          </span>
                        </span>
                        <TopicStatusBadge status={p.status} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent activity">
            {learning.recentActivity.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">No finished games yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {learning.recentActivity.map((a) => {
                  const Icon = engineIcon(a.engineId)
                  return (
                    <li key={a.sessionId}>
                      <Link href={`/gameroom-v2/results/${a.sessionId}`} className="flex items-center justify-between gap-3 py-2.5">
                        <span className="flex items-center gap-3 min-w-0">
                          <Icon className="w-4 h-4 text-primary-700 dark:text-primary-400 flex-shrink-0" aria-hidden />
                          <span className="min-w-0">
                            <span className="block font-tamil font-medium leading-relaxed text-stone-800 dark:text-stone-100 truncate">{getBuiltinTopic(a.topicKey)?.tamilTitle}</span>
                            <span className="block text-xs text-stone-500 dark:text-stone-400">
                              {getGameEngineV2(a.engineId)?.name} · {formatDateOnly(a.completedAt.slice(0, 10))}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm text-stone-600 dark:text-stone-300 flex-shrink-0">
                          {a.accuracy}% · +{a.xpEarned} XP
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Achievements">
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            {earned.size} of {ACHIEVEMENTS.length} earned
          </p>
          <div className="flex flex-wrap gap-4">
            {ACHIEVEMENTS.map((a) => (
              <div key={a.id} title={a.studentDescription}>
                <GameV2Badge label={a.name} locked={!earned.has(a.id)} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </GameRoomShell>
  )
}
