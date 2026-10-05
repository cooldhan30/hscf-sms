import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { GameLauncher } from '@/components/gameRoomV2/launcher/GameLauncher'
import { MoreLinks } from '@/components/gameRoomV2/launcher/MoreLinks'
import type { LauncherProps } from '@/components/gameRoomV2/launcher/types'

// Teacher (and admin) GameRoom home: "My questions" at the top (add,
// upload via /gameroom-v2/library/import, edit), then the same four-choice
// launcher students use, ending in "Start live with my class". The
// library, analytics and boards are in the "More" row.
export function TeacherHome(props: LauncherProps & { initialTopicKey?: string | null }) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <PageHeader
        title="Game Room"
        tamilTitle="விளையாட்டு அறை"
        description="Pick a topic, a game, how many questions and how long each one gets -- then start a live game. Your class joins with a code."
      />
      <GameLauncher {...props} />
      <MoreLinks role="teacher" />
    </div>
  )
}
