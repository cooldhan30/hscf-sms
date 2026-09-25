import { GameRoomStudentClient } from './GameRoomStudentClient'
import { GameRoomModeSwitch } from '@/components/gameRoomMode/GameRoomModeSwitch'
import { isNewGameRoomReleased } from '@/lib/gameRoomMode'

export const dynamic = 'force-dynamic'

export default function StudentGameRoomPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
          {/* Temporary migration fallback. Remove Classic GameRoom only after GameRoom V2 production stabilization. */}
          {isNewGameRoomReleased() && <GameRoomModeSwitch to="v2" />}
        </div>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Join a game your teacher is hosting, practice on your own, and see how you rank.
        </p>
      </div>

      <GameRoomStudentClient />
    </div>
  )
}
