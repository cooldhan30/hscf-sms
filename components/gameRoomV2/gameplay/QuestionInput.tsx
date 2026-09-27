'use client'

import { useState } from 'react'
import { AnswerOption, GameV2Button } from '@/components/gameRoomV2'
import type { GameRoomQuestionType } from '@/lib/gameRoomV2/domain'
import { Bi, ta } from '@/components/gameRoomV2/Bi'

// Renders the right input control for a question type, and calls
// onSubmit with the raw answer value once the student commits -- this
// is the one place QuestionOverlay delegates to per-type UI, so adding
// a new implemented question type later means adding one case here,
// never touching QuestionOverlay/the session routes/gradeAnswer's
// callers.
export function QuestionInput({
  questionType,
  payload,
  disabled,
  pendingAnswer,
  onSubmit,
}: {
  questionType: GameRoomQuestionType
  payload: Record<string, unknown>
  disabled: boolean
  pendingAnswer: unknown
  onSubmit: (answer: unknown) => void
}) {
  switch (questionType) {
    case 'MULTIPLE_CHOICE':
    case 'AUDIO_CHOICE':
      return <ChoiceInput options={(payload.options as string[]) ?? []} audioUrl={payload.audioUrl as string | undefined} disabled={disabled} pendingAnswer={pendingAnswer} onSubmit={onSubmit} />
    case 'TRUE_FALSE':
      return <TrueFalseInput disabled={disabled} pendingAnswer={pendingAnswer} onSubmit={onSubmit} />
    case 'IMAGE_CHOICE':
      return <ImageChoiceInput options={(payload.options as { imageUrl: string; label?: string }[]) ?? []} disabled={disabled} pendingAnswer={pendingAnswer} onSubmit={onSubmit} />
    case 'TEXT_INPUT':
      return <TextInput disabled={disabled} onSubmit={onSubmit} />
    case 'ORDER_LETTERS':
      return <OrderInput items={(payload.letters as string[]) ?? []} disabled={disabled} onSubmit={onSubmit} />
    case 'ORDER_WORDS':
      return <OrderInput items={(payload.words as string[]) ?? []} disabled={disabled} onSubmit={onSubmit} />
    case 'CATEGORIZE':
      return <CategorizeInput items={(payload.items as string[]) ?? []} categories={(payload.categories as string[]) ?? []} disabled={disabled} onSubmit={onSubmit} />
    case 'MATCH':
      return <MatchInput left={(payload.left as string[]) ?? []} right={(payload.right as string[]) ?? []} disabled={disabled} onSubmit={onSubmit} />
    case 'FILL_BLANK':
      return <FillBlankInput blankCount={(payload.blankCount as number) ?? 0} disabled={disabled} onSubmit={onSubmit} />
    default:
      return <p className="text-center text-sm text-gamev2ink-400"><Bi k="notPlayable" /></p>
  }
}

function ChoiceInput({
  options,
  audioUrl,
  disabled,
  pendingAnswer,
  onSubmit,
}: {
  options: string[]
  audioUrl?: string
  disabled: boolean
  pendingAnswer: unknown
  onSubmit: (answer: unknown) => void
}) {
  return (
    <div className="space-y-3">
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}
      <div className={`grid gap-3 ${options.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((opt) => (
          <AnswerOption
            key={opt}
            label={opt}
            state={pendingAnswer === opt ? 'selected' : 'idle'}
            disabled={disabled}
            onClick={() => onSubmit(opt)}
          />
        ))}
      </div>
    </div>
  )
}

function TrueFalseInput({ disabled, pendingAnswer, onSubmit }: { disabled: boolean; pendingAnswer: unknown; onSubmit: (a: unknown) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <AnswerOption label={ta('trueWord', true)} state={pendingAnswer === true ? 'selected' : 'idle'} disabled={disabled} onClick={() => onSubmit(true)} />
      <AnswerOption label={ta('falseWord', true)} state={pendingAnswer === false ? 'selected' : 'idle'} disabled={disabled} onClick={() => onSubmit(false)} />
    </div>
  )
}

function ImageChoiceInput({
  options,
  disabled,
  pendingAnswer,
  onSubmit,
}: {
  options: { imageUrl: string; label?: string }[]
  disabled: boolean
  pendingAnswer: unknown
  onSubmit: (a: unknown) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.imageUrl}
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(opt.imageUrl)}
          className={`rounded-2xl overflow-hidden border-2 transition-colors disabled:cursor-not-allowed ${
            pendingAnswer === opt.imageUrl ? 'border-gamev2ink-600' : 'border-gamev2ink-200 dark:border-gamev2ink-700'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary teacher-provided image URL */}
          <img src={opt.imageUrl} alt={opt.label ?? ''} className="w-full h-28 object-cover" />
        </button>
      ))}
    </div>
  )
}

function TextInput({ disabled, onSubmit }: { disabled: boolean; onSubmit: (a: unknown) => void }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value)
      }}
      className="flex gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        lang="ta"
        aria-label={ta('yourAnswer', true)}
        className="flex-1 px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 font-tamil leading-relaxed text-lg"
        placeholder={ta('typeAnswer')}
      />
      <GameV2Button type="submit" size="md" disabled={disabled || !value.trim()}>
        <Bi k="submit" inline />
      </GameV2Button>
    </form>
  )
}

function OrderInput({ items, disabled, onSubmit }: { items: string[]; disabled: boolean; onSubmit: (a: unknown) => void }) {
  const [order, setOrder] = useState<string[]>([])
  const remaining = items.filter((i) => !order.includes(i))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[3rem] p-2 rounded-2xl border-2 border-dashed border-gamev2ink-200 dark:border-gamev2ink-700">
        {order.map((item, i) => (
          <button
            key={`${item}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => setOrder(order.filter((_, idx) => idx !== i))}
            className="px-3 py-2 rounded-xl bg-gamev2ink-800 text-white font-tamil leading-relaxed font-bold"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {remaining.map((item, i) => (
          <button
            key={`${item}-${i}`}
            type="button"
            disabled={disabled}
            onClick={() => setOrder([...order, item])}
            className="px-3 py-2 rounded-xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 font-tamil leading-relaxed font-bold"
          >
            {item}
          </button>
        ))}
      </div>
      <GameV2Button fullWidth disabled={disabled || order.length !== items.length} onClick={() => onSubmit(order)}>
        <Bi k="submitOrder" inline />
      </GameV2Button>
    </div>
  )
}

function CategorizeInput({
  items,
  categories,
  disabled,
  onSubmit,
}: {
  items: string[]
  categories: string[]
  disabled: boolean
  onSubmit: (a: unknown) => void
}) {
  const [assignments, setAssignments] = useState<Record<string, string>>({})

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-center justify-between gap-2">
          <span className="font-tamil leading-relaxed font-semibold">{item}</span>
          <select
            value={assignments[item] ?? ''}
            disabled={disabled}
            onChange={(e) => setAssignments({ ...assignments, [item]: e.target.value })}
            className="px-3 py-2 rounded-xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 font-tamil leading-relaxed"
          >
            <option value="">{ta('choose')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      ))}
      <GameV2Button
        fullWidth
        disabled={disabled || items.some((i) => !assignments[i])}
        onClick={() => onSubmit(assignments)}
      >
        <Bi k="submit" inline />
      </GameV2Button>
    </div>
  )
}

function MatchInput({ left, right, disabled, onSubmit }: { left: string[]; right: string[]; disabled: boolean; onSubmit: (a: unknown) => void }) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({})

  function pickRight(rightItem: string) {
    if (!selectedLeft) return
    setMatches({ ...matches, [selectedLeft]: rightItem })
    setSelectedLeft(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {left.map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled || Boolean(matches[item])}
              onClick={() => setSelectedLeft(item)}
              className={`w-full px-3 py-2 rounded-xl border-2 font-tamil leading-relaxed text-sm ${
                selectedLeft === item ? 'border-gamev2ink-600 bg-gamev2ink-50 dark:bg-gamev2ink-800' : 'border-gamev2ink-200 dark:border-gamev2ink-700'
              } ${matches[item] ? 'opacity-50' : ''}`}
            >
              {item} {matches[item] ? `→ ${matches[item]}` : ''}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((item) => (
            <button
              key={item}
              type="button"
              disabled={disabled || !selectedLeft || Object.values(matches).includes(item)}
              onClick={() => pickRight(item)}
              className="w-full px-3 py-2 rounded-xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 font-tamil leading-relaxed text-sm disabled:opacity-40"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <GameV2Button fullWidth disabled={disabled || Object.keys(matches).length !== left.length} onClick={() => onSubmit(matches)}>
        <Bi k="submitMatches" inline />
      </GameV2Button>
    </div>
  )
}

function FillBlankInput({ blankCount, disabled, onSubmit }: { blankCount: number; disabled: boolean; onSubmit: (a: unknown) => void }) {
  const [answers, setAnswers] = useState<string[]>(Array.from({ length: blankCount }, () => ''))

  return (
    <div className="space-y-3">
      {answers.map((value, i) => (
        <input
          key={i}
          value={value}
          onChange={(e) => setAnswers(answers.map((a, idx) => (idx === i ? e.target.value : a)))}
          disabled={disabled}
          lang="ta"
          aria-label={`${ta('blank')} ${i + 1}`}
          placeholder={`${ta('blank')} ${i + 1}`}
          className="w-full px-4 py-3 rounded-2xl border-2 border-gamev2ink-200 dark:border-gamev2ink-700 bg-white dark:bg-gamev2ink-900 font-tamil leading-relaxed text-lg"
        />
      ))}
      <GameV2Button fullWidth disabled={disabled || answers.some((a) => !a.trim())} onClick={() => onSubmit(answers)}>
        <Bi k="submit" inline />
      </GameV2Button>
    </div>
  )
}
