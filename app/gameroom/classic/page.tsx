import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old /gameroom/classic links follow the same rule as /gameroom: V2 while
// released, the legacy GameRoom only when rolled back
// (GAMEROOM_V2_ENABLED=false -- see docs/gameroom-v2-rollback.md).
export default function ClassicGameRoomRedirect() {
  redirect('/gameroom')
}
