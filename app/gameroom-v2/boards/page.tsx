import Link from 'next/link'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, ProgressBar } from '@/components/gameRoomV2/shell/ui'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { LEARNING_BOARDS, getBuiltinTopic } from '@/lib/gameRoomV2/builtin/catalog'

export const dynamic = 'force-dynamic'

export default async function LearningBoardsPage() {
  const ctx = await loadGameRoomPage('/gameroom-v2/boards')
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  return (
    <GameRoomShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Learning Boards"
          tamilTitle="கற்றல் பலகைகள்"
          description="Each board is a path of Tamil topics. Master a topic by scoring 80% or more in any of its games."
          backHref="/gameroom-v2"
          backLabel="Game Room"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEARNING_BOARDS.map((b) => {
            const progress = ctx.learning?.boardProgress.find((p) => p.boardId === b.id)
            return (
              <Link
                key={b.id}
                href={`/gameroom-v2/boards/${b.id}`}
                className="flex flex-col p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800 transition-colors"
              >
                <h2 className="text-lg font-bold text-primary-900 dark:text-white">{b.title}</h2>
                <p className="font-tamil leading-relaxed text-stone-600 dark:text-stone-300">{b.tamilTitle}</p>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{b.description}</p>
                <p className="font-tamil text-sm leading-relaxed text-stone-500 dark:text-stone-400 mt-3">
                  {b.topicKeys.map((k) => getBuiltinTopic(k)?.tamilTitle).join(' · ')}
                </p>
                {progress && (
                  <div className="mt-4">
                    <ProgressBar percent={progress.percent} label={`${b.title} progress`} />
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5">
                      {progress.mastered}/{progress.total} topics mastered
                      {progress.practicing > 0 ? ` · ${progress.practicing} in progress` : ''}
                    </p>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </GameRoomShell>
  )
}
