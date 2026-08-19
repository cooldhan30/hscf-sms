import { StoryGeneratorClient } from './StoryGeneratorClient'

export const dynamic = 'force-dynamic'

export default function StoryGeneratorPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Story Generator</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Generate a Tamil children&apos;s story from a theme -- pick an age and let it write.
        </p>
      </div>

      <StoryGeneratorClient />
    </div>
  )
}
