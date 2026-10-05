'use client'

import { JoinLiveBox } from '@/components/gameRoomV2/liveClassroom/JoinLiveBox'
import { PageHeader } from '@/components/gameRoomV2/shell/ui'
import { GameLauncher } from '@/components/gameRoomV2/launcher/GameLauncher'
import { MoreLinks } from '@/components/gameRoomV2/launcher/MoreLinks'
import type { LauncherProps } from '@/components/gameRoomV2/launcher/types'

// The student GameRoom home: four choices (topic, game, questions, time)
// and Play. Progress, badges, Trace & Learn and the Learning Boards sit in
// the "More" row underneath.
export function HomeScreenClient(props: LauncherProps & { initialTopicKey?: string | null }) {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Live Classroom first: a student arriving with a code from their
          teacher should never have to hunt for where to type it. */}
      <JoinLiveBox />
      <PageHeader
        title="Game Room"
        tamilTitle="விளையாட்டு அறை"
        description={`${props.firstName ? `Welcome, ${props.firstName}. ` : ''}Choose a topic and a game, then press Play.`}
      />
      <GameLauncher {...props} />
      <MoreLinks role="student" />
    </div>
  )
}
