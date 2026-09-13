import { Suspense } from 'react'
import { MayangoliJoinClient } from './MayangoliJoinClient'

export const dynamic = 'force-dynamic'

export default function MayangoliStudentPage() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">மயங்கொலி Challenge</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Enter the game code your teacher gave you.</p>
      </div>

      <Suspense fallback={null}>
        <MayangoliJoinClient />
      </Suspense>
    </div>
  )
}
