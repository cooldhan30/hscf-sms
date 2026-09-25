import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { TopicLibraryClient } from '@/components/gameRoomV2/learning/TopicLibraryClient'
import { loadGameRoomPage } from '@/lib/gameRoomV2/builtin/pageContext'
import { allTopicSummaries } from '@/lib/gameRoomV2/builtin/summaries'
import { GAME_ENGINES_V2 } from '@/lib/gameRoomV2/registry'

export const dynamic = 'force-dynamic'

// Topic Library: every built-in Tamil topic. For teachers this is the
// "Built-in Tamil Content" section (read-only; host live / duplicate from
// a topic's page).
export default async function TopicLibraryPage({ searchParams }: { searchParams: { game?: string } }) {
  const ctx = await loadGameRoomPage('/gameroom-v2/topics')
  if (!ctx.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={ctx.error} />
      </GameRoomShell>
    )
  }

  const topics = allTopicSummaries()
  const games = GAME_ENGINES_V2.filter((e) => topics.some((t) => t.engines.some((x) => x.engineId === e.id))).map((e) => ({ id: e.id, name: e.name }))
  const statuses = ctx.learning ? Object.fromEntries(Object.entries(ctx.learning.topicProgress).map(([k, p]) => [k, p.status])) : undefined
  const initialGame = games.some((g) => g.id === searchParams.game) ? searchParams.game! : ''
  const isTeacher = ctx.role !== 'student'

  return (
    <GameRoomShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title={isTeacher ? 'Built-in Tamil Content' : 'Tamil Topics'}
          tamilTitle="தமிழ்த் தலைப்புகள்"
          description={
            isTeacher
              ? 'Ready-made, read-only Tamil content. Open a topic to preview it, host it live, or duplicate it into My Question Sets.'
              : 'Choose what you want to practise, then choose how you want to play.'
          }
          backHref="/gameroom-v2"
          backLabel="Game Room"
        />
        <TopicLibraryClient topics={topics} statuses={statuses} initialGame={initialGame} games={games} />
      </div>
    </GameRoomShell>
  )
}
