'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiArrowRight, FiCheck, FiSave, FiPlay } from 'react-icons/fi'
import { GameV2Button, GameV2Card } from '@/components/gameRoomV2'
import { MetadataStep, emptyMetadata, type SetMetadata } from './MetadataStep'
import { QuestionListStep } from './QuestionListStep'
import { QuestionPreviewCard } from './QuestionPreviewCard'
import { CompatibilityResults } from './CompatibilityResults'
import { ChooseGameModal } from './ChooseGameModal'
import { toast } from '@/lib/toast'
import { validateQuestionSet, type GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import type { DraftQuestion } from './types'

const STEPS = ['Metadata', 'Add Questions', 'Preview', 'Validate & Save', 'Use It'] as const

export interface BuilderInitialData {
  id: string
  metadata: SetMetadata
  questions: DraftQuestion[]
}

export function BuilderWizard({ initial }: { initial?: BuilderInitialData }) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [metadata, setMetadata] = useState<SetMetadata>(initial?.metadata ?? emptyMetadata())
  const [questions, setQuestions] = useState<DraftQuestion[]>(initial?.questions ?? [])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null)
  const [chooseGameOpen, setChooseGameOpen] = useState(false)

  const step = STEPS[stepIndex]

  const questionTypes = useMemo(
    () => Array.from(new Set(questions.map((q) => q.questionType))) as GameRoomQuestionType[],
    [questions]
  )

  const validationProblems = useMemo(
    () => validateQuestionSet(questions.map((q) => ({ questionType: q.questionType, prompt: q.prompt, payload: q.payload }))),
    [questions]
  )
  const metadataValid = metadata.title.trim().length > 0

  function goTo(index: number) {
    setStepIndex(Math.max(0, Math.min(STEPS.length - 1, index)))
  }

  async function handleSave() {
    if (!metadataValid) {
      setSaveError('Title is required.')
      goTo(0)
      return
    }
    if (validationProblems.length > 0) {
      setSaveError('Fix the highlighted problems before saving.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const body = {
      title: metadata.title,
      description: metadata.description || null,
      tamilTitle: metadata.tamilTitle || null,
      englishTitle: metadata.englishTitle || null,
      level: metadata.level || null,
      subject: metadata.subject || null,
      topic: metadata.topic || null,
      difficulty: metadata.difficulty || null,
      estimatedDurationMinutes: metadata.estimatedDurationMinutes || null,
      tags: metadata.tags,
      visibility: metadata.visibility,
      published: false,
      questions: questions.map((q) => ({
        questionType: q.questionType,
        prompt: q.prompt,
        payload: q.payload,
        explanation: q.explanation || null,
        mediaUrl: q.mediaUrl,
        points: q.points,
        dimension: q.dimension,
        conceptTags: q.conceptTags,
      })),
    }

    const url = savedId ? `/api/gameroom-v2/question-sets/${savedId}` : '/api/gameroom-v2/question-sets'
    const method = savedId ? 'PATCH' : 'POST'

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setSaveError(data.error || 'Failed to save question set')
      return
    }

    setSavedId(data.questionSet.id)
    toast.success('Question set saved')
    goTo(4)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => (i <= stepIndex || savedId ? goTo(i) : undefined)}
            disabled={i > stepIndex && !savedId}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
              i === stepIndex
                ? 'bg-gamev2ink-800 text-white'
                : i < stepIndex || savedId
                  ? 'text-gamev2ink-600 dark:text-gamev2ink-300 hover:bg-gamev2ink-100 dark:hover:bg-gamev2ink-800'
                  : 'text-gamev2ink-300 dark:text-gamev2ink-700 cursor-not-allowed'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {step === 'Metadata' && (
        <GameV2Card padding="lg">
          <MetadataStep value={metadata} onChange={setMetadata} />
        </GameV2Card>
      )}

      {step === 'Add Questions' && <QuestionListStep questions={questions} onChange={setQuestions} />}

      {step === 'Preview' && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <GameV2Card>
              <p className="text-center text-gamev2ink-400 dark:text-gamev2ink-500 py-8">No questions to preview yet.</p>
            </GameV2Card>
          ) : (
            questions.map((q, i) => (
              <div key={q.localId}>
                <p className="text-xs font-bold uppercase tracking-wide text-gamev2ink-400 dark:text-gamev2ink-500 mb-1.5">
                  Question {i + 1}
                </p>
                <QuestionPreviewCard question={q} />
              </div>
            ))
          )}
        </div>
      )}

      {step === 'Validate & Save' && (
        <div className="space-y-4">
          <GameV2Card>
            <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 mb-3">Validation</p>
            {!metadataValid && (
              <p className="text-sm text-gamev2coral-600 dark:text-gamev2coral-400 mb-2">Title is required (Metadata step).</p>
            )}
            {validationProblems.length === 0 && metadataValid ? (
              <p className="text-sm text-gamev2mint-600 dark:text-gamev2mint-400 flex items-center gap-1.5">
                <FiCheck className="w-4 h-4" /> Everything looks good -- ready to save.
              </p>
            ) : (
              <ul className="text-sm text-gamev2coral-600 dark:text-gamev2coral-400 list-disc list-inside space-y-1">
                {validationProblems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
          </GameV2Card>

          {questionTypes.length > 0 && <CompatibilityResults questionTypes={questionTypes} />}

          {saveError && (
            <p className="text-sm text-gamev2coral-600 dark:text-gamev2coral-400 bg-gamev2coral-50 dark:bg-gamev2coral-500/10 rounded-xl px-4 py-3">
              {saveError}
            </p>
          )}

          <GameV2Button
            variant="spark"
            fullWidth
            disabled={saving || validationProblems.length > 0 || !metadataValid}
            onClick={handleSave}
          >
            <FiSave className="w-4 h-4" /> {saving ? 'Saving...' : savedId ? 'Save Changes' : 'Save Question Set'}
          </GameV2Button>
        </div>
      )}

      {step === 'Use It' && savedId && (
        <div className="space-y-4">
          <GameV2Card>
            <p className="font-extrabold text-gamev2ink-800 dark:text-gamev2ink-100 mb-1">Saved!</p>
            <p className="text-sm text-gamev2ink-500 dark:text-gamev2ink-400">
              &quot;{metadata.title}&quot; is saved. Play it yourself, host it live for your class, or keep editing.
            </p>
          </GameV2Card>

          {questionTypes.length > 0 && <CompatibilityResults questionTypes={questionTypes} />}

          {questionTypes.length > 0 && (
            <GameV2Button variant="spark" fullWidth onClick={() => setChooseGameOpen(true)}>
              <FiPlay className="w-4 h-4" /> Play or Host Live
            </GameV2Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <GameV2Button variant="ghost" onClick={() => router.push('/gameroom-v2/builder')}>
              Back to My Sets
            </GameV2Button>
            <GameV2Button
              variant="ghost"
              onClick={() => {
                setSaveError(null)
                goTo(3)
              }}
            >
              Keep Editing
            </GameV2Button>
          </div>

          {questionTypes.length > 0 && (
            <ChooseGameModal
              open={chooseGameOpen}
              onClose={() => setChooseGameOpen(false)}
              questionSetId={savedId}
              questionTypes={questionTypes}
              setTitle={metadata.title}
            />
          )}
        </div>
      )}

      {/* Step navigation (hidden on the final step, which has its own actions) */}
      {step !== 'Use It' && (
        <div className="flex items-center justify-between pt-2">
          <GameV2Button variant="ghost" size="md" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>
            <FiArrowLeft className="w-4 h-4" /> Back
          </GameV2Button>
          {step !== 'Validate & Save' && (
            <GameV2Button size="md" onClick={() => goTo(stepIndex + 1)}>
              Next <FiArrowRight className="w-4 h-4" />
            </GameV2Button>
          )}
        </div>
      )}
    </div>
  )
}
