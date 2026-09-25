'use client'

import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import { QUESTION_SET_DIFFICULTIES, QUESTION_SET_VISIBILITIES, type QuestionSetVisibility } from '@/lib/gameRoomV2/domain'
import { TamilTextInput, TamilTextArea } from './TamilTextInput'

// SetMetadata/emptyMetadata live in types.ts (a plain module) so SERVER
// components can call emptyMetadata() -- a function exported from this
// 'use client' file is only a client reference on the server, and calling
// it there throws ("is not a function"), which broke Edit Question Set.
export { emptyMetadata, type SetMetadata } from './types'
import type { SetMetadata } from './types'

const VISIBILITY_INFO: Record<QuestionSetVisibility, { label: string; description: string }> = {
  PRIVATE: { label: 'Private', description: 'Only you can see and use this set.' },
  SCHOOL: { label: 'School', description: 'Every teacher at the school can see and reuse this set.' },
  PUBLIC: { label: 'Public', description: 'Visible to every teacher, same as School for now.' },
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-stone-700 dark:text-stone-200 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
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
      <Field label="Title (internal name, for your own list)" required>
        <TamilTextInput value={value.title} onChange={(v) => set('title', v)} placeholder="e.g. Thinai Grammar Set 3" />
        {!value.title.trim() && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1">A title is required before you can save this set.</p>
        )}
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
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary-300"
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
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white"
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
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300'
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400'
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
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary-300"
          />
        </Field>
        <Field label="Topic">
          <input
            type="text"
            value={value.topic}
            onChange={(e) => set('topic', e.target.value)}
            placeholder="e.g. Thinai"
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary-300"
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
          className="w-full sm:w-40 px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary-300"
        />
      </Field>

      <Field label="Tags (comma-separated)">
        <input
          type="text"
          value={value.tags.join(', ')}
          onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
          placeholder="grammar, thinai, beginner"
          className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary-300"
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
                  ? 'border-stone-600 bg-stone-50 dark:bg-stone-800'
                  : 'border-stone-200 dark:border-stone-700'
              }`}
            >
              <p className="font-bold text-stone-800 dark:text-stone-100">{VISIBILITY_INFO[v].label}</p>
              <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{VISIBILITY_INFO[v].description}</p>
            </button>
          ))}
        </div>
      </Field>

      <label className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 cursor-pointer">
        <input
          type="checkbox"
          checked={value.published}
          onChange={(e) => set('published', e.target.checked)}
          className="mt-1 w-5 h-5 accent-stone-600"
        />
        <span>
          <span className="block font-bold text-stone-800 dark:text-stone-100">Students can play this on their own</span>
          <span className="block text-xs text-stone-400 dark:text-stone-500 mt-0.5">
            Shows this set on the GameRoom home for students in its class (or every student, if it isn&apos;t assigned to a class). You can always host it live either way.
          </span>
        </span>
      </label>
    </div>
  )
}
