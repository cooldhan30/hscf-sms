'use client'

import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { TamilTextInput } from './TamilTextInput'
import type { DraftQuestion } from './types'
import { GameV2Button } from '@/components/gameRoomV2'

// One editor per implemented question type, switched on
// question.questionType. Each editor is deliberately small and
// type-specific (not one generic "options editor" reused everywhere)
// since each type's payload shape genuinely differs -- MATCH needs
// pairs, CATEGORIZE needs items+categories+an assignment grid,
// ORDER_WORDS needs a target order distinct from the scrambled
// input list. All editors share the same update contract: call
// onChange with a fully-replaced payload object.
export function QuestionTypeEditor({
  question,
  onChange,
}: {
  question: DraftQuestion
  onChange: (payload: Record<string, unknown>) => void
}) {
  switch (question.questionType) {
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceEditor payload={question.payload} onChange={onChange} />
    case 'TRUE_FALSE':
      return <TrueFalseEditor payload={question.payload} onChange={onChange} />
    case 'IMAGE_CHOICE':
      return <ImageChoiceEditor payload={question.payload} onChange={onChange} />
    case 'TEXT_INPUT':
      return <TextInputEditor payload={question.payload} onChange={onChange} />
    case 'FILL_BLANK':
      return <FillBlankEditor prompt={question.prompt} payload={question.payload} onChange={onChange} />
    case 'MATCH':
      return <MatchEditor payload={question.payload} onChange={onChange} />
    case 'ORDER_LETTERS':
      return <OrderEditor itemLabel="Letters" itemsKey="letters" payload={question.payload} onChange={onChange} />
    case 'ORDER_WORDS':
      return <OrderEditor itemLabel="Words" itemsKey="words" payload={question.payload} onChange={onChange} />
    case 'CATEGORIZE':
      return <CategorizeEditor payload={question.payload} onChange={onChange} />
    case 'AUDIO_CHOICE':
      return <AudioChoiceEditor payload={question.payload} onChange={onChange} />
    default:
      return (
        <p className="text-sm text-stone-400 dark:text-stone-500">
          &quot;{question.questionType}&quot; has no authoring support yet.
        </p>
      )
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-1.5">{children}</label>
}

function AddRemoveList({
  items,
  onAdd,
  onRemove,
  minItems = 2,
  children,
}: {
  items: unknown[]
  onAdd: () => void
  onRemove: (index: number) => void
  minItems?: number
  children: (index: number) => React.ReactNode
}) {
  return (
    <div className="space-y-2">
      {items.map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">{children(i)}</div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            disabled={items.length <= minItems}
            aria-label="Remove"
            className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <GameV2Button type="button" variant="ghost" size="md" onClick={onAdd} className="!min-h-0 !py-2">
        <FiPlus className="w-4 h-4" /> Add
      </GameV2Button>
    </div>
  )
}

function MultipleChoiceEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const options: string[] = Array.isArray(payload.options) ? (payload.options as string[]) : ['', '']
  const correctAnswer = typeof payload.correctAnswer === 'string' ? payload.correctAnswer : ''

  function setOption(i: number, value: string) {
    const next = [...options]
    const prevValue = next[i]
    next[i] = value
    onChange({ options: next, correctAnswer: correctAnswer === prevValue ? value : correctAnswer })
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Answer Choices</FieldLabel>
      <AddRemoveList
        items={options}
        onAdd={() => onChange({ options: [...options, ''], correctAnswer })}
        onRemove={(i) => {
          const next = options.filter((_, idx) => idx !== i)
          onChange({ options: next, correctAnswer: next.includes(correctAnswer) ? correctAnswer : '' })
        }}
      >
        {(i) => <TamilTextInput value={options[i]} onChange={(v) => setOption(i, v)} placeholder={`Choice ${i + 1}`} />}
      </AddRemoveList>

      <FieldLabel>Correct Answer</FieldLabel>
      <select
        value={correctAnswer}
        onChange={(e) => onChange({ options, correctAnswer: e.target.value })}
        className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-primary-900 dark:text-white font-tamil leading-relaxed"
      >
        <option value="">Select the correct choice...</option>
        {options
          .filter((o) => o.trim())
          .map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
      </select>
    </div>
  )
}

function TrueFalseEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const correctAnswer = typeof payload.correctAnswer === 'boolean' ? payload.correctAnswer : null

  return (
    <div>
      <FieldLabel>Correct Answer</FieldLabel>
      <div className="flex gap-2">
        {[
          { value: true, label: 'True' },
          { value: false, label: 'False' },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange({ correctAnswer: opt.value })}
            className={`flex-1 px-4 py-3 rounded-2xl font-bold border-2 transition-colors ${
              correctAnswer === opt.value
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ImageChoiceEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const options: { imageUrl: string; label?: string }[] = Array.isArray(payload.options)
    ? (payload.options as { imageUrl: string; label?: string }[])
    : [{ imageUrl: '', label: '' }, { imageUrl: '', label: '' }]
  const correctAnswer = typeof payload.correctAnswer === 'string' ? payload.correctAnswer : ''

  function setOption(i: number, field: 'imageUrl' | 'label', value: string) {
    const next = options.map((o, idx) => (idx === i ? { ...o, [field]: value } : o))
    onChange({ options: next, correctAnswer })
  }

  return (
    <div className="space-y-3">
      <FieldLabel>Image Options (paste an image URL from Resources, or your own hosted URL)</FieldLabel>
      <AddRemoveList
        items={options}
        onAdd={() => onChange({ options: [...options, { imageUrl: '', label: '' }], correctAnswer })}
        onRemove={(i) => onChange({ options: options.filter((_, idx) => idx !== i), correctAnswer })}
      >
        {(i) => (
          <div className="flex gap-2">
            <input
              type="url"
              value={options[i].imageUrl}
              onChange={(e) => setOption(i, 'imageUrl', e.target.value)}
              placeholder="Image URL"
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
            />
            <TamilTextInput
              value={options[i].label ?? ''}
              onChange={(v) => setOption(i, 'label', v)}
              placeholder="Label (optional)"
              className="!py-2 !text-base"
            />
          </div>
        )}
      </AddRemoveList>

      <FieldLabel>Correct Image</FieldLabel>
      <select
        value={correctAnswer}
        onChange={(e) => onChange({ options, correctAnswer: e.target.value })}
        className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900"
      >
        <option value="">Select the correct image...</option>
        {options
          .filter((o) => o.imageUrl.trim())
          .map((o, i) => (
            <option key={i} value={o.imageUrl}>
              {o.label || o.imageUrl}
            </option>
          ))}
      </select>
    </div>
  )
}

function TextInputEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const acceptedAnswers: string[] = Array.isArray(payload.acceptedAnswers) ? (payload.acceptedAnswers as string[]) : ['']

  return (
    <div>
      <FieldLabel>Accepted Answers (any spelling variant a student types will be accepted)</FieldLabel>
      <AddRemoveList
        items={acceptedAnswers}
        minItems={1}
        onAdd={() => onChange({ acceptedAnswers: [...acceptedAnswers, ''] })}
        onRemove={(i) => onChange({ acceptedAnswers: acceptedAnswers.filter((_, idx) => idx !== i) })}
      >
        {(i) => (
          <TamilTextInput
            value={acceptedAnswers[i]}
            onChange={(v) => onChange({ acceptedAnswers: acceptedAnswers.map((a, idx) => (idx === i ? v : a)) })}
            placeholder="Accepted answer"
          />
        )}
      </AddRemoveList>
    </div>
  )
}

function FillBlankEditor({
  prompt,
  payload,
  onChange,
}: {
  prompt: string
  payload: Record<string, unknown>
  onChange: (p: Record<string, unknown>) => void
}) {
  const blankCount = (prompt.match(/___/g) ?? []).length
  const blanks: string[][] = Array.isArray(payload.blanks) ? (payload.blanks as string[][]) : []

  // Keep the number of blank-answer-sets in sync with the number of
  // "___" markers actually typed in the prompt -- the teacher edits the
  // marker count by editing the question text itself, not a separate
  // counter control.
  const syncedBlanks = Array.from({ length: blankCount }, (_, i) => blanks[i] ?? [''])

  function setBlankAnswers(i: number, answers: string[]) {
    onChange({ blanks: syncedBlanks.map((b, idx) => (idx === i ? answers : b)) })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Type <code className="font-mono bg-stone-100 dark:bg-stone-800 px-1 rounded">___</code> in the question
        text above wherever you want a blank. Found {blankCount} blank marker{blankCount === 1 ? '' : 's'}.
      </p>
      {syncedBlanks.map((answers, i) => (
        <div key={i}>
          <FieldLabel>Blank {i + 1} -- accepted answers</FieldLabel>
          <AddRemoveList
            items={answers}
            minItems={1}
            onAdd={() => setBlankAnswers(i, [...answers, ''])}
            onRemove={(idx) => setBlankAnswers(i, answers.filter((_, a) => a !== idx))}
          >
            {(idx) => (
              <TamilTextInput
                value={answers[idx]}
                onChange={(v) => setBlankAnswers(i, answers.map((a, aIdx) => (aIdx === idx ? v : a)))}
                placeholder="Accepted answer"
              />
            )}
          </AddRemoveList>
        </div>
      ))}
    </div>
  )
}

function MatchEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const pairs: { left: string; right: string }[] = Array.isArray(payload.pairs)
    ? (payload.pairs as { left: string; right: string }[])
    : [{ left: '', right: '' }, { left: '', right: '' }]

  function setPair(i: number, field: 'left' | 'right', value: string) {
    onChange({ pairs: pairs.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)) })
  }

  return (
    <div>
      <FieldLabel>Pairs to Match</FieldLabel>
      <AddRemoveList
        items={pairs}
        onAdd={() => onChange({ pairs: [...pairs, { left: '', right: '' }] })}
        onRemove={(i) => onChange({ pairs: pairs.filter((_, idx) => idx !== i) })}
      >
        {(i) => (
          <div className="flex items-center gap-2">
            <TamilTextInput value={pairs[i].left} onChange={(v) => setPair(i, 'left', v)} placeholder="Left" className="!py-2" />
            <span className="text-stone-300 dark:text-stone-600" aria-hidden>
              ↔
            </span>
            <TamilTextInput value={pairs[i].right} onChange={(v) => setPair(i, 'right', v)} placeholder="Right" className="!py-2" />
          </div>
        )}
      </AddRemoveList>
    </div>
  )
}

function OrderEditor({
  itemLabel,
  itemsKey,
  payload,
  onChange,
}: {
  itemLabel: string
  itemsKey: 'letters' | 'words'
  payload: Record<string, unknown>
  onChange: (p: Record<string, unknown>) => void
}) {
  const items: string[] = Array.isArray(payload[itemsKey]) ? (payload[itemsKey] as string[]) : ['', '']
  const correctOrder: string[] = Array.isArray(payload.correctOrder) ? (payload.correctOrder as string[]) : []

  function setItem(i: number, value: string) {
    const next = [...items]
    next[i] = value
    onChange({ [itemsKey]: next, correctOrder })
  }

  // The correct order is built by clicking items in the right sequence
  // -- simpler and less error-prone for a teacher than typing the order
  // out separately (which risks a typo that JSON.stringify-mismatches
  // the actual item list, exactly the failure validateQuestionPayload
  // checks for).
  function toggleInOrder(item: string) {
    if (correctOrder.includes(item)) {
      onChange({ [itemsKey]: items, correctOrder: correctOrder.filter((o) => o !== item) })
    } else {
      onChange({ [itemsKey]: items, correctOrder: [...correctOrder, item] })
    }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>{itemLabel} (in scrambled/starting order)</FieldLabel>
      <AddRemoveList
        items={items}
        onAdd={() => onChange({ [itemsKey]: [...items, ''], correctOrder })}
        onRemove={(i) => {
          const removed = items[i]
          onChange({ [itemsKey]: items.filter((_, idx) => idx !== i), correctOrder: correctOrder.filter((o) => o !== removed) })
        }}
      >
        {(i) => <TamilTextInput value={items[i]} onChange={(v) => setItem(i, v)} placeholder={`${itemLabel.slice(0, -1)} ${i + 1}`} />}
      </AddRemoveList>

      <FieldLabel>Correct Order (click each item below, in order)</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {items
          .filter((i) => i.trim())
          .map((item, i) => {
            const position = correctOrder.indexOf(item)
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleInOrder(item)}
                className={`px-3 py-2 rounded-xl border-2 font-tamil leading-relaxed font-semibold ${
                  position !== -1
                    ? 'border-stone-600 bg-stone-50 dark:bg-stone-800 text-primary-900 dark:text-white'
                    : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400'
                }`}
              >
                {position !== -1 && <span className="text-xs font-bold mr-1">{position + 1}.</span>}
                {item}
              </button>
            )
          })}
      </div>
    </div>
  )
}

function CategorizeEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const items: string[] = Array.isArray(payload.items) ? (payload.items as string[]) : ['', '']
  const categories: string[] = Array.isArray(payload.categories) ? (payload.categories as string[]) : ['', '']
  const answerKey: Record<string, string> = payload.answerKey && typeof payload.answerKey === 'object' ? (payload.answerKey as Record<string, string>) : {}

  function setItem(i: number, value: string) {
    const prev = items[i]
    const next = [...items]
    next[i] = value
    const nextKey = { ...answerKey }
    if (prev in nextKey) {
      nextKey[value] = nextKey[prev]
      delete nextKey[prev]
    }
    onChange({ items: next, categories, answerKey: nextKey })
  }

  function setCategory(i: number, value: string) {
    const next = [...categories]
    next[i] = value
    onChange({ items, categories: next, answerKey })
  }

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Categories</FieldLabel>
        <AddRemoveList
          items={categories}
          onAdd={() => onChange({ items, categories: [...categories, ''], answerKey })}
          onRemove={(i) => onChange({ items, categories: categories.filter((_, idx) => idx !== i), answerKey })}
        >
          {(i) => <TamilTextInput value={categories[i]} onChange={(v) => setCategory(i, v)} placeholder={`Category ${i + 1}`} />}
        </AddRemoveList>
      </div>

      <div>
        <FieldLabel>Items -- assign each to a category</FieldLabel>
        <AddRemoveList
          items={items}
          onAdd={() => onChange({ items: [...items, ''], categories, answerKey })}
          onRemove={(i) => {
            const removed = items[i]
            const nextKey = { ...answerKey }
            delete nextKey[removed]
            onChange({ items: items.filter((_, idx) => idx !== i), categories, answerKey: nextKey })
          }}
        >
          {(i) => (
            <div className="flex items-center gap-2">
              <TamilTextInput value={items[i]} onChange={(v) => setItem(i, v)} placeholder={`Item ${i + 1}`} className="flex-1" />
              <select
                value={answerKey[items[i]] ?? ''}
                onChange={(e) => onChange({ items, categories, answerKey: { ...answerKey, [items[i]]: e.target.value } })}
                disabled={!items[i]?.trim()}
                className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 font-tamil leading-relaxed disabled:opacity-40"
              >
                <option value="">Category...</option>
                {categories
                  .filter((c) => c.trim())
                  .map((c, ci) => (
                    <option key={ci} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </AddRemoveList>
      </div>
    </div>
  )
}

function AudioChoiceEditor({ payload, onChange }: { payload: Record<string, unknown>; onChange: (p: Record<string, unknown>) => void }) {
  const audioUrl = typeof payload.audioUrl === 'string' ? payload.audioUrl : ''
  const options: string[] = Array.isArray(payload.options) ? (payload.options as string[]) : ['', '']
  const correctAnswer = typeof payload.correctAnswer === 'string' ? payload.correctAnswer : ''

  return (
    <div className="space-y-3">
      <FieldLabel>Audio Clip URL (upload to Resources first, then paste the link here)</FieldLabel>
      <input
        type="url"
        value={audioUrl}
        onChange={(e) => onChange({ audioUrl: e.target.value, options, correctAnswer })}
        placeholder="https://..."
        className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm"
      />
      {audioUrl.trim() && <audio controls src={audioUrl} className="w-full" />}

      <FieldLabel>Answer Choices</FieldLabel>
      <AddRemoveList
        items={options}
        onAdd={() => onChange({ audioUrl, options: [...options, ''], correctAnswer })}
        onRemove={(i) => onChange({ audioUrl, options: options.filter((_, idx) => idx !== i), correctAnswer })}
      >
        {(i) => (
          <TamilTextInput
            value={options[i]}
            onChange={(v) => onChange({ audioUrl, options: options.map((o, idx) => (idx === i ? v : o)), correctAnswer })}
            placeholder={`Choice ${i + 1}`}
          />
        )}
      </AddRemoveList>

      <FieldLabel>Correct Answer</FieldLabel>
      <select
        value={correctAnswer}
        onChange={(e) => onChange({ audioUrl, options, correctAnswer: e.target.value })}
        className="w-full px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 font-tamil leading-relaxed"
      >
        <option value="">Select the correct choice...</option>
        {options
          .filter((o) => o.trim())
          .map((o, i) => (
            <option key={i} value={o}>
              {o}
            </option>
          ))}
      </select>
    </div>
  )
}
