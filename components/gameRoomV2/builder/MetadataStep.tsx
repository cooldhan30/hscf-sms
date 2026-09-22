'use client'

import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { QUESTION_SET_DIFFICULTIES, QUESTION_SET_VISIBILITIES, type QuestionSetVisibility, type QuestionSetDifficulty } from '@/lib/gameRoomV2/domain'
import { TamilTextInput, TamilTextArea } from './TamilTextInput'

export interface SetMetadata {
  title: string
  description: string
  tamilTitle: string
  englishTitle: string
  level: string
  subject: string
  topic: string
  difficulty: QuestionSetDifficulty | ''
  estimatedDurationMinutes: string
  tags: string[]
  visibility: QuestionSetVisibility
}

export function emptyMetadata(): SetMetadata {
  return {
    title: '',
    description: '',
    tamilTitle: '',
    englishTitle: '',
    level: '',
    subject: '',
    topic: '',
    difficulty: '',
    estimatedDurationMinutes: '',
    tags: [],
    visibility: 'PRIVATE',
  }
}

const VISIBILITY_INFO: Record<QuestionSetVisibility, { label: string; description: string }> = {
  PRIVATE: { label: 'Private', description: 'Only you can see and use this set.' },
  SCHOOL: { label: 'School', description: 'Every teacher at the school can see and reuse this set.' },
  PUBLIC: { label: 'Public', description: 'Visible to every teacher, same as School for now.' },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gamev2ink-700 dark:text-gamev2ink-200 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function MetadataStep({ value, onChange }: { value: SetMetadata; onChange: (v: SetMetadata) => void }) {
  function set<K extends keyof SetMetadata>(key: K, v: SetMetadata[K]) {
    onChange({ ...value, [key]: v })
  }

  return (
    <div className="space-y-5">
      <Field label="Title (internal name, for your own list)">
        <TamilTextInput value={value.title} onChange={(v) => set('title', v)} placeholder="e.g. Thinai Grammar Set 3" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tamil Display Title (optional)">
          <TamilTextInput value={value.tamilTitle} onChange={(v) => set('tamilTitle', v)} placeholder="திணை சவால்" />
        </Field>
        <Field label="English Display Title (optional)">
          <input
            type="text"
            value={value.englishTitle}
            onChange={(e) => set('englishTitle', e.target.value)}
            placeholder="Thinai Challenge"
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gamev2spark-300"
          />
        </Field>
      </div>

      <Field label="Description (optional)">
        <TamilTextArea value={value.description} onChange={(v) => set('description', v)} placeholder="What is this set about?" rows={2} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Level / நிலை">
          <select
            value={value.level}
            onChange={(e) => set('level', e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white"
          >
            <option value="">Not set</option>
            {GRADE_LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <div className="flex gap-2">
            {QUESTION_SET_DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set('difficulty', value.difficulty === d ? '' : d)}
                className={`flex-1 px-3 py-3 rounded-2xl font-bold border-2 capitalize transition-colors ${
                  value.difficulty === d
                    ? 'border-gamev2spark-500 bg-gamev2spark-50 dark:bg-gamev2spark-500/10 text-gamev2spark-700 dark:text-gamev2spark-300'
                    : 'border-gamev2ink-200 dark:border-gamev2ink-700 text-gamev2ink-500 dark:text-gamev2ink-400'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Subject / Category">
          <input
            type="text"
            value={value.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="e.g. Grammar"
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gamev2spark-300"
          />
        </Field>
        <Field label="Topic">
          <input
            type="text"
            value={value.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder="e.g. Thinai"
            className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gamev2spark-300"
          />
        </Field>
      </div>

      <Field label="Estimated Duration (minutes)">
        <input
          type="number"
          min={1}
          value={value.estimatedDurationMinutes}
          onChange={(e) => set('estimatedDurationMinutes', e.target.value)}
          placeholder="10"
          className="w-full sm:w-40 px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gamev2spark-300"
        />
      </Field>

      <Field label="Tags (comma-separated)">
        <input
          type="text"
          value={value.tags.join(', ')}
          onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          placeholder="grammar, thinai, beginner"
          className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 text-gamev2ink-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-gamev2spark-300"
        />
      </Field>

      <Field label="Visibility">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {QUESTION_SET_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set('visibility', v)}
              className={`text-left px-4 py-3 rounded-2xl border-2 transition-colors ${
                value.visibility === v
                  ? 'border-gamev2ink-600 bg-gamev2ink-50 dark:bg-gamev2ink-800'
                  : 'border-gamev2ink-200 dark:border-gamev2ink-700'
              }`}
            >
              <p className="font-bold text-gamev2ink-800 dark:text-gamev2ink-100">{VISIBILITY_INFO[v].label}</p>
              <p className="text-xs text-gamev2ink-400 dark:text-gamev2ink-500 mt-0.5">{VISIBILITY_INFO[v].description}</p>
            </button>
          ))}
        </div>
      </Field>
    </div>
  )
}
