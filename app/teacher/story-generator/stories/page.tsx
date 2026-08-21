import { MyStoriesClient } from './MyStoriesClient'

export const dynamic = 'force-dynamic'

export default function MyStoriesPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Stories</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Stories you&apos;ve saved from the Story Generator.</p>
      </div>

      <MyStoriesClient />
    </div>
  )
}
