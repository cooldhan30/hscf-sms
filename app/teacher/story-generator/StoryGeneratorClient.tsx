'use client'

import { useState } from 'react'
import { FiFeather } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

export function StoryGeneratorClient() {
  const [theme, setTheme] = useState('')
  const [language, setLanguage] = useState<'ta' | 'en'>('ta')
  const [targetAge, setTargetAge] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [story, setStory] = useState<string | null>(null)

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (generating) return

    setGenerating(true)
    setError(null)

    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme,
          language,
          targetAge: targetAge ? Number(targetAge) : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error || 'Failed to generate story')
        return
      }

      setStory(data.story)
    } catch {
      setError('Failed to generate story -- check your connection and try again')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="space-y-4 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        {error && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
            Theme / Idea
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="e.g. ஒரு நண்பன் உதவும் கதை, or 'a story about a helpful elephant'"
            rows={3}
            required
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Tamil or English -- the story itself is always written in Tamil.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Target Age (optional)
            </label>
            <input
              type="number"
              min="1"
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value)}
              placeholder="e.g. 7"
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Theme Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'ta' | 'en')}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="ta">Tamil</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth icon={<FiFeather />} disabled={generating}>
          {generating ? 'Generating story...' : 'Generate Story'}
        </Button>
      </form>

      {story && (
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <h2 className="font-bold text-stone-800 dark:text-stone-100 mb-3">Generated Story</h2>
          <p className="text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">{story}</p>
        </div>
      )}
    </div>
  )
}
