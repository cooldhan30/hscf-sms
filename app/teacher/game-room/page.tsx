import { GameRoomHostClient } from './GameRoomHostClient'
import { GameRoomModeSwitch } from '@/components/gameRoomMode/GameRoomModeSwitch'
import { isNewGameRoomReleased } from '@/lib/gameRoomMode'

export const dynamic = 'force-dynamic'

export default function GameRoomPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
          {/* Temporary migration fallback. Remove Classic GameRoom only after GameRoom V2 production stabilization. */}
          {isNewGameRoomReleased() && <GameRoomModeSwitch to="v2" />}
        </div>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Host a live classroom quiz -- students join with a code, you start the game once, and everyone plays at their own pace.
        </p>
      </div>

      <GameRoomHostClient />
    </div>
  )
}
