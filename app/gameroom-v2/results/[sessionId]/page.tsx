import Link from 'next/link'
import { notFound } from 'next/navigation'
import { FiStar, FiTarget, FiCheckCircle, FiTrendingUp, FiArrowRight } from 'react-icons/fi'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader, SectionCard, StatCard, TopicStatusBadge, ProgressBar, secondaryLinkButton } from '@/components/gameRoomV2/shell/ui'
import { PlayButton } from '@/components/gameRoomV2/learning/PlayButton'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { topicForSetId, LEARNING_BOARDS, getBuiltinTopic, setForEngine } from '@/lib/gameRoomV2/builtin/catalog'
import { MASTERY_ACCURACY_PCT } from '@/lib/gameRoomV2/builtin/progress'
import { getGameEngineV2 } from '@/lib/gameRoomV2/registry'
import { levelForXp } from '@/lib/gameRoomV2/progression'

export const dynamic = 'force-dynamic'

// After a solo game: the saved result (server-authoritative numbers from
// the session row), XP/level, updated topic and board progress, and what
// to practise next. Reached from every engine's own end screen.
export default async function SessionResultsPage({ params }: { params: { sessionId: string } }) {
  const ctx = await loadGameRoomPage(`/gameroom-v2/results/${params.sessionId}`)
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }
  if (ctx.role !== 'student' || !ctx.studentId || !ctx.learning) notFound()

  // RLS ("gamev2_sessions: student read own") -- another student's session id yields nothing.
  const { data: session } = await ctx.supabase
    .from('sms_gamev2_sessions')
    .select('id, question_set_id, engine_id, status, score, correct_count, answered_count, xp_earned, coins_earned, question_order')
    .eq('id', params.sessionId)
    .eq('student_id', ctx.studentId)
    .maybeSingle()
  if (!session) notFound()

  const learning = ctx.learning
  const topic = topicForSetId(session.question_set_id)
  const engine = getGameEngineV2(session.engine_id)
  const finished = session.status === 'COMPLETED'
  const accuracy = session.answered_count > 0 ? Math.round((session.correct_count / session.answered_count) * 100) : 0
  const progress = topic ? learning.topicProgress[topic.key] : undefined
  const board = topic ? LEARNING_BOARDS.find((b) => b.topicKeys.includes(topic.key)) : undefined
  const boardProgress = board ? learning.boardProgress.find((p) => p.boardId === board.id) : undefined
  const { level } = levelForXp(learning.stats.xp)
  const recommendations = learning.recommendations.filter((r) => r.topicKey !== topic?.key || r.kind !== 'next')

  return (
    <GameRoomShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader
          title={finished ? 'Game complete' : 'Game not finished'}
          tamilTitle={topic?.tamilTitle}
          description={`${engine?.name ?? 'Game'}${topic ? ` · ${topic.englishTitle}` : ''}`}
          backHref="/gameroom-v2"
          backLabel="Game Room"
        />

        {finished ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FiTarget} value={`${accuracy}%`} label="Accuracy" />
            <StatCard icon={FiCheckCircle} value={`${session.correct_count}/${session.answered_count}`} label="Correct answers" />
            <StatCard icon={FiStar} value={`+${session.xp_earned}`} label="XP earned" />
            <StatCard icon={FiTrendingUp} value={`Level ${level}`} label={`${learning.stats.xp.toLocaleString()} XP total`} />
          </div>
        ) : (
          <SectionCard title="This game wasn't finished">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Only finished games count toward your progress. You answered {session.answered_count} of {(session.question_order as string[]).length} questions.
            </p>
            {session.status !== 'ABANDONED' && (
              <Link href={`/gameroom-v2/play/${session.id}`} className={`${secondaryLinkButton} mt-4`}>
                Resume game <FiArrowRight className="w-4 h-4" aria-hidden />
              </Link>
            )}
          </SectionCard>
        )}

        {topic && progress && (
          <SectionCard title="Topic progress">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-tamil text-lg font-semibold leading-relaxed text-stone-800 dark:text-stone-100">{topic.tamilTitle}</p>
              <TopicStatusBadge status={progress.status} />
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {progress.status === 'mastered'
                ? `Mastered -- best accuracy ${Math.round(progress.bestAccuracy ?? 0)}%.`
                : progress.status === 'practicing'
                  ? `Best accuracy ${Math.round(progress.bestAccuracy ?? 0)}% -- reach ${MASTERY_ACCURACY_PCT}% to master it.`
                  : `Finish a game with ${MASTERY_ACCURACY_PCT}% or more to master this topic.`}
            </p>
            {board && boardProgress && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <Link href={`/gameroom-v2/boards/${board.id}`} className="font-medium text-primary-700 dark:text-primary-400 hover:underline">
                    {board.title}
                  </Link>
                  <span className="text-stone-500 dark:text-stone-400">
                    {boardProgress.mastered}/{boardProgress.total} mastered
                  </span>
                </div>
                <ProgressBar percent={boardProgress.percent} label={`${board.title} progress`} />
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard title="Recommended Next">
          <ul className="space-y-3">
            {recommendations.map((r) => {
              const recTopic = getBuiltinTopic(r.topicKey)
              const quiz = recTopic ? setForEngine(recTopic, 'classic-quiz') : undefined
              return (
                <li key={r.topicKey} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Link href={`/gameroom-v2/topics/${r.topicKey}`} className="min-w-0 group">
                    <p className="font-medium font-tamil leading-relaxed text-stone-800 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400">{r.title}</p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{r.reason}</p>
                  </Link>
                  {quiz && <PlayButton questionSetId={quiz.id} engineId="classic-quiz" label="Play Classic Quiz" variant="secondary" />}
                </li>
              )
            })}
          </ul>
        </SectionCard>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {engine && <PlayButton questionSetId={session.question_set_id} engineId={engine.id} label="Play again" again />}
          {topic && (
            <Link href={`/gameroom-v2/topics/${topic.key}`} className={secondaryLinkButton}>
              Choose another game
            </Link>
          )}
          <Link href="/gameroom-v2/progress" className={secondaryLinkButton}>
            My progress
          </Link>
        </div>
      </div>
    </GameRoomShell>
  )
}
