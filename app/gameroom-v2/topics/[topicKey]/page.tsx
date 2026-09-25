import { notFound } from 'next/navigation'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, Card, Pill, TopicStatusBadge, ProgressBar } from '@/components/gameRoomV2/shell/ui'
import { TopicGameChooser } from '@/components/gameRoomV2/learning/TopicGameChooser'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { getBuiltinTopic, LEARNING_BOARDS } from '@/lib/gameRoomV2/builtin/catalog'
import { summarizeTopic, CATEGORY_LABELS } from '@/lib/gameRoomV2/builtin/summaries'
import { MASTERY_ACCURACY_PCT } from '@/lib/gameRoomV2/builtin/progress'

export const dynamic = 'force-dynamic'

// Topic -> Choose Game. Students pick a compatible game and play; teachers
// host it live, preview it, or duplicate it.
export default async function TopicPage({ params, searchParams }: { params: { topicKey: string }; searchParams: { board?: string } }) {
  const topic = getBuiltinTopic(params.topicKey)
  if (!topic) notFound()

  const ctx = await loadGameRoomPage(`/gameroom-v2/topics/${params.topicKey}`)
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  const summary = summarizeTopic(topic)
  const progress = ctx.learning?.topicProgress[topic.key]
  const board = LEARNING_BOARDS.find((b) => b.id === searchParams.board) ?? LEARNING_BOARDS.find((b) => b.topicKeys.includes(topic.key))
  const isStudent = ctx.role === 'student'

  return (
    <GameRoomShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={topic.englishTitle}
          tamilTitle={topic.tamilTitle}
          description={topic.description}
          backHref={board ? `/gameroom-v2/boards/${board.id}` : '/gameroom-v2/topics'}
          backLabel={board ? board.title : 'Tamil Topics'}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Pill>{CATEGORY_LABELS[topic.category]}</Pill>
          <Pill>{topic.difficulty}</Pill>
          <Pill>{summary.questionCount} questions</Pill>
          {!isStudent && <Pill>Built-in · read-only</Pill>}
        </div>

        {isStudent && progress && (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-800 dark:text-stone-100">Your progress</p>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {progress.completions === 0
                    ? `Finish a game with ${MASTERY_ACCURACY_PCT}% or more to master this topic.`
                    : `${progress.completions} game${progress.completions === 1 ? '' : 's'} finished · best accuracy ${Math.round(progress.bestAccuracy ?? 0)}%`}
                </p>
              </div>
              <TopicStatusBadge status={progress.status} />
            </div>
            {progress.completions > 0 && (
              <div className="mt-3">
                <ProgressBar percent={((progress.bestAccuracy ?? 0) / MASTERY_ACCURACY_PCT) * 100} label="Progress toward mastery" />
              </div>
            )}
          </Card>
        )}

        <div>
          <h2 className="text-lg font-bold text-primary-900 dark:text-white mb-1">Choose a game</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            {isStudent
              ? 'Every game below practises this topic -- pick the one you feel like playing.'
              : 'Only games that can play this topic are shown. Classic Quiz, Racing and Boss Battle can be hosted live for a class.'}
          </p>
          <TopicGameChooser
            topic={summary}
            role={isStudent ? 'student' : 'teacher'}
            sets={isStudent ? [] : topic.sets.map((s) => ({ id: s.id, title: s.title, kind: s.kind, questionCount: s.questions.length }))}
          />
        </div>
      </div>
    </GameRoomShell>
  )
}
