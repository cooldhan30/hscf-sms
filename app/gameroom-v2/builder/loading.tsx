import { GameV2Loading } from '@/components/gameRoomV2'

export default function BuilderLoading() {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gamev2ink-950 px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <GameV2Loading label="Loading your question sets..." />
      </div>
    </div>
  )
}
