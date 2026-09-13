import { GameRoomModeSelector } from './GameRoomModeSelector'

export const dynamic = 'force-dynamic'

export default function GameRoomPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Host a live classroom game -- students join with a code, you start the game once everyone&apos;s in.
        </p>
      </div>

      <GameRoomModeSelector />
    </div>
  )
}
