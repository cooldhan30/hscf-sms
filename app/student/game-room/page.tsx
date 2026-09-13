import { Suspense } from 'react'
import { GameRoomStudentClient } from './GameRoomStudentClient'

export const dynamic = 'force-dynamic'

export default function StudentGameRoomPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Game Room</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Join a game your teacher is hosting, practice on your own, and see how you rank.
        </p>
      </div>

      <Suspense fallback={null}>
        <GameRoomStudentClient />
      </Suspense>
    </div>
  )
}
