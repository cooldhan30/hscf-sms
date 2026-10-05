import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { requireGameV2Teacher } from '@/lib/gameRoomV2/requireTeacherAccess'
import { GameRoomShell, GameRoomUnavailable } from '@/components/gameRoomV2/shell/GameRoomShell'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { ImportWizard } from '@/components/gameRoomV2/builder/ImportWizard'

export const dynamic = 'force-dynamic'

// Import a question set from a .txt or .csv file. Teacher-only (same gate
// as the Builder); the file is parsed in the browser and the set is
// saved through the Builder's own POST /api/gameroom-v2/question-sets,
// which re-validates everything and sets ownership server-side.
export default async function ImportQuestionSetPage() {
  const { userId } = await auth()
  if (!userId) redirect(`/login?next=${encodeURIComponent('/gameroom-v2/library/import')}`)
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
      <div className="max-w-4xl mx-auto space-y-4">
        <PageHeader
          title="Import Question Set"
          tamilTitle="வினாத் தொகுப்பைப் பதிவேற்று"
          description="Upload a .txt or .csv file, check the preview, then create the set."
          backHref="/gameroom-v2"
          backLabel="Game Room"
        />
        <ImportWizard />
      </div>
    </GameRoomShell>
  )
}
