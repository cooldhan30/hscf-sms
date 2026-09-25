'use client'

import { useState } from 'react'
import { FiPlus, FiCopy, FiTrash2, FiChevronUp, FiChevronDown, FiEdit2, FiEye } from 'react-icons/fi'
import {
  GAME_ROOM_V2_QUESTION_TYPES,
  IMPLEMENTED_QUESTION_TYPES,
  isImplementedQuestionType,
  validateQuestionPayload,
  type GameRoomQuestionType,
} from '@/lib/gameRoomV2/domain'
import { GameV2Button, GameV2Card, GameV2Empty } from '@/components/gameRoomV2'
import { TamilTextArea } from './TamilTextInput'
import { QuestionTypeEditor } from './QuestionTypeEditor'
import { QuestionPreviewCard } from './QuestionPreviewCard'
import { emptyDraftQuestion, type DraftQuestion } from './types'
import { LEARNING_DIMENSIONS, DIMENSION_LABELS, CONCEPT_SUGGESTIONS, type LearningDimension } from '@/lib/gameRoomV2/analytics'

const TYPE_LABEL: Record<GameRoomQuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  IMAGE_CHOICE: 'Image Choice',
  TEXT_INPUT: 'Text Input',
  FILL_BLANK: 'Fill in the Blank',
  MATCH: 'Match',
  ORDER_LETTERS: 'Order Letters',
  ORDER_WORDS: 'Order Words',
  CATEGORIZE: 'Categorize',
  AUDIO_CHOICE: 'Audio Choice',
  PRONUNCIATION: 'Pronunciation',
  READING_FLUENCY: 'Reading Fluency',
}

export function QuestionListStep({
  questions,
  onChange,
}: {
  questions: DraftQuestion[]
  onChange: (questions: DraftQuestion[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(questions[0]?.localId ?? null)
  const [addPickerOpen, setAddPickerOpen] = useState(false)

  const editingQuestion = questions.find((q) => q.localId === editingId) ?? null

  function addQuestion(type: GameRoomQuestionType) {
    const q = emptyDraftQuestion(type)
    onChange([...questions, q])
    setEditingId(q.localId)
    setAddPickerOpen(false)
  }

  function updateQuestion(localId: string, patch: Partial<DraftQuestion>) {
    onChange(questions.map((q) => (q.localId === localId ? { ...q, ...patch } : q)))
  }

  function duplicateQuestion(localId: string) {
    const source = questions.find((q) => q.localId === localId)
    if (!source) return
    const index = questions.findIndex((q) => q.localId === localId)
    const copy: DraftQuestion = { ...source, localId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, id: undefined }
    const next = [...questions]
    next.splice(index + 1, 0, copy)
    onChange(next)
  }

  function deleteQuestion(localId: string) {
    onChange(questions.filter((q) => q.localId !== localId))
    if (editingId === localId) setEditingId(null)
  }

  function moveQuestion(localId: string, direction: -1 | 1) {
    const index = questions.findIndex((q) => q.localId === localId)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= questions.length) return
    const next = [...questions]
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    onChange(next)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      {/* Question list / reorder / duplicate / delete */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-stone-800 dark:text-stone-100">{questions.length} Question{questions.length === 1 ? '' : 's'}</p>
          <div className="relative">
            <GameV2Button size="md" variant="spark" onClick={() => setAddPickerOpen((v) => !v)} className="!min-h-0 !py-2 !px-4">
              <FiPlus className="w-4 h-4" /> Add
            </GameV2Button>
            {addPickerOpen && (
              <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xl p-2">
                {GAME_ROOM_V2_QUESTION_TYPES.map((type) => {
                  const implemented = isImplementedQuestionType(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={!implemented}
                      onClick={() => addQuestion(type)}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-between"
                    >
                      {TYPE_LABEL[type]}
                      {!implemented && <span className="text-[10px] font-bold uppercase text-stone-400">Soon</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {questions.length === 0 ? (
          <GameV2Card padding="sm">
            <GameV2Empty title="No questions yet" description="Click Add to create your first question." />
          </GameV2Card>
        ) : (
          <div className="space-y-2">
            {questions.map((q, i) => {
              const problems = validateQuestionPayload(q.questionType, q.prompt, q.payload)
              return (
                <div
                  key={q.localId}
                  className={`rounded-2xl border-2 p-3 ${
                    editingId === q.localId
                      ? 'border-stone-600 bg-stone-50 dark:bg-stone-800'
                      : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
                  }`}
                >
                  <button type="button" onClick={() => setEditingId(q.localId)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                          {i + 1}. {TYPE_LABEL[q.questionType]}
                        </p>
                        <p className="font-tamil leading-relaxed text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                          {q.prompt || <span className="italic text-stone-400">No question text yet</span>}
                        </p>
                      </div>
                      {problems.length > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center" title={problems.join('; ')}>
                          !
                        </span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 mt-2">
                    <button type="button" onClick={() => moveQuestion(q.localId, -1)} disabled={i === 0} aria-label="Move up" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white disabled:opacity-20">
                      <FiChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveQuestion(q.localId, 1)} disabled={i === questions.length - 1} aria-label="Move down" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white disabled:opacity-20">
                      <FiChevronDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => duplicateQuestion(q.localId)} aria-label="Duplicate" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-white">
                      <FiCopy className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteQuestion(q.localId)} aria-label="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {IMPLEMENTED_QUESTION_TYPES.length < GAME_ROOM_V2_QUESTION_TYPES.length && (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Pronunciation and Reading Fluency are planned but can&apos;t be authored yet.
          </p>
        )}
      </div>

      {/* Editor for the selected question */}
      <div>
        {editingQuestion ? (
          <QuestionEditorPanel
            question={editingQuestion}
            onChange={(patch) => updateQuestion(editingQuestion.localId, patch)}
          />
        ) : (
          <GameV2Card>
            <GameV2Empty title="Select a question to edit" description="Or add a new one from the list on the left." />
          </GameV2Card>
        )}
      </div>
    </div>
  )
}

function QuestionEditorPanel({ question, onChange }: { question: DraftQuestion; onChange: (patch: Partial<DraftQuestion>) => void }) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const problems = validateQuestionPayload(question.questionType, question.prompt, question.payload)

  return (
    <GameV2Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
          {TYPE_LABEL[question.questionType]}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 ${mode === 'edit' ? 'bg-primary-800 text-white' : 'text-stone-500 dark:text-stone-400'}`}
          >
            <FiEdit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1.5 ${mode === 'preview' ? 'bg-primary-800 text-white' : 'text-stone-500 dark:text-stone-400'}`}
          >
            <FiEye className="w-3.5 h-3.5" /> Preview
          </button>
        </div>
      </div>

      {mode === 'preview' ? (
        <QuestionPreviewCard question={question} />
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
              Question Text
            </label>
            <TamilTextArea value={question.prompt} onChange={(v) => onChange({ prompt: v })} placeholder="Type the question..." rows={2} />
          </div>

          <QuestionTypeEditor question={question} onChange={(payload) => onChange({ payload })} />

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
              Explanation (optional -- shown after answering)
            </label>
            <TamilTextArea value={question.explanation} onChange={(v) => onChange({ explanation: v })} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
                Points
              </label>
              <input
                type="number"
                min={1}
                value={question.points}
                onChange={(e) => onChange({ points: Number(e.target.value) || 100 })}
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
                Image/Audio URL (optional)
              </label>
              <input
                type="url"
                value={question.mediaUrl ?? ''}
                onChange={(e) => onChange({ mediaUrl: e.target.value || null })}
                placeholder="From Resources, or your own hosted URL"
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              Learning Analytics (optional)
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 -mt-2">
              Tag this question so teacher reports can track student progress by skill, separately from game
              scores. Leaving this blank is fine -- it just won&apos;t show up in dimension-specific reports.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
                  Dimension
                </label>
                <select
                  value={question.dimension ?? ''}
                  onChange={(e) => onChange({ dimension: (e.target.value || null) as LearningDimension | null })}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
                >
                  <option value="">Not tagged</option>
                  {LEARNING_DIMENSIONS.map((d) => (
                    <option key={d} value={d}>
                      {DIMENSION_LABELS[d].name} ({DIMENSION_LABELS[d].tamilName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">
                  Concepts (comma-separated)
                </label>
                <input
                  type="text"
                  list="gamev2-concept-suggestions"
                  value={question.conceptTags.join(', ')}
                  onChange={(e) => onChange({ conceptTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                  placeholder="e.g. திணை, எண்"
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 font-tamil leading-relaxed"
                />
                <datalist id="gamev2-concept-suggestions">
                  {CONCEPT_SUGGESTIONS.map((c) => (
                    <option key={c.id} value={c.tamilName} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {problems.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900 p-3">
              <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5">
                {problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </GameV2Card>
  )
}
