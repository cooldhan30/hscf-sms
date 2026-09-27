'use client'

import { JoinLiveBox } from '@/components/gameRoomV2/liveClassroom/JoinLiveBox'

// The standalone join page uses the same join box as the top of the
// student GameRoom home.
export function JoinCodeClient() {
  return (
    <div className="w-full max-w-md">
      <JoinLiveBox variant="card" />
    </div>
  )
}
