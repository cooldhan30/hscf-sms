import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiChevronRight } from 'react-icons/fi'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, ProgressBar, TopicStatusBadge, Pill, Card } from '@/components/gameRoomV2/shell/ui'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { getLearningBoard } from '@/lib/gameRoomV2/builtin/catalog'
import { topicSummary } from '@/lib/gameRoomV2/builtin/summaries'

export const dynamic = 'force-dynamic'

export default async function LearningBoardPage({ params }: { params: { boardId: string } }) {
  const board = getLearningBoard(params.boardId)
  if (!board) notFound()

  const ctx = await loadGameRoomPage(`/gameroom-v2/boards/${params.boardId}`)
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  const progress = ctx.learning?.boardProgress.find((p) => p.boardId === board.id)
  const topics = board.topicKeys.map((k) => topicSummary(k)!).filter(Boolean)

  return (
    <GameRoomShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader title={board.title} tamilTitle={board.tamilTitle} description={board.description} backHref="/gameroom-v2/boards" backLabel="Learning Boards" />

        {progress && (
          <Card>
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="font-semibold text-stone-800 dark:text-stone-100">Your progress</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {progress.mastered}/{progress.total} mastered{progress.practicing > 0 ? ` · ${progress.practicing} in progress` : ''}
              </p>
            </div>
            <ProgressBar percent={progress.percent} label={`${board.title} progress`} />
          </Card>
        )}

        <ol className="space-y-3">
          {topics.map((t, i) => {
            const p = ctx.learning?.topicProgress[t.key]
            return (
              <li key={t.key}>
                <Link
                  href={`/gameroom-v2/topics/${t.key}`}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-tamil text-lg font-semibold leading-relaxed text-stone-800 dark:text-stone-100 break-words">{t.tamilTitle}</span>
                    <span className="block text-sm text-stone-500 dark:text-stone-400">
                      {t.englishTitle} · {t.engines.length} games
                      {p?.bestAccuracy != null ? ` · best ${Math.round(p.bestAccuracy)}%` : ''}
                    </span>
                  </span>
                  <span className="hidden sm:flex items-center gap-2 flex-shrink-0">
                    {p ? <TopicStatusBadge status={p.status} /> : <Pill>{t.difficulty}</Pill>}
                  </span>
                  <FiChevronRight className="w-5 h-5 text-stone-400 flex-shrink-0" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </GameRoomShell>
  )
}
