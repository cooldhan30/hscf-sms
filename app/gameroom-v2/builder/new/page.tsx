import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { BuilderWizard } from '@/components/gameRoomV2/builder/BuilderWizard'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'

export const dynamic = 'force-dynamic'

export default async function NewQuestionSetPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent('/gameroom-v2/builder/new')}`)
  }

  const access = await requireGameV2Teacher()
  if (!access.ok) {
    return (
      <GameRoomShell>
        <GameRoomUnavailable message={access.error} />
      </GameRoomShell>
    )
  }

  return (
    <GameRoomShell>
      <div className="max-w-4xl mx-auto mb-6">
        <PageHeader
          title="Create Question Set"
          description="Create content once, then play it through any compatible game later."
          backHref="/gameroom-v2/builder"
          backLabel="Question Set Builder"
        />
      </div>
      <BuilderWizard />
    </GameRoomShell>
  )
}
