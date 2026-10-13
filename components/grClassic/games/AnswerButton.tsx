'use client'

import { FiCheck, FiHeart, FiMoon, FiStar, FiSun, FiX } from 'react-icons/fi'
import { tamilLang } from '@/lib/grClassic/graphemes'

// The four answer colours. Each also carries a symbol (sun, moon, star,
// heart) so answers are never told apart by colour alone. Not Tamil
// letters: on a letters quiz a letter badge would look like an answer.
export const ANSWER_STYLES = [
  { icon: FiSun, name: 'sun', cls: 'bg-teal-600 text-white shadow-[0_6px_0_0_#115e59]' },
  { icon: FiMoon, name: 'moon', cls: 'bg-rose-600 text-white shadow-[0_6px_0_0_#9f1239]' },
  { icon: FiStar, name: 'star', cls: 'bg-amber-400 text-amber-950 shadow-[0_6px_0_0_#b45309]' },
  { icon: FiHeart, name: 'heart', cls: 'bg-indigo-600 text-white shadow-[0_6px_0_0_#3730a3]' },
]

export type AnswerState = 'idle' | 'chosen' | 'correct' | 'wrong' | 'dim'

export function AnswerButton({ index, text, state = 'idle', disabled, onClick, size = 'md' }: { index: number; text: string; state?: AnswerState; disabled?: boolean; onClick?: () => void; size?: 'md' | 'xl' }) {
  const s = ANSWER_STYLES[index % 4]
  const look = {
    idle: 'hover:brightness-110 active:translate-y-1.5 active:shadow-none',
    chosen: 'ring-4 ring-slate-900 ring-offset-2 ring-offset-[#fff8ee]',
    correct: 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-[#fff8ee]',
    wrong: 'opacity-70',
    dim: 'opacity-30',
  }[state]
  const textSize = size === 'xl' ? 'min-h-[7rem] text-3xl sm:text-4xl' : 'min-h-[5rem] text-2xl'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Answer ${index + 1}: ${text}`}
      lang={tamilLang(text)}
      className={`relative flex w-full items-center gap-4 rounded-3xl px-5 py-4 text-left font-bold transition disabled:cursor-default ${s.cls} ${textSize} ${look}`}
    >
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/25">
        <s.icon className="h-6 w-6" strokeWidth={3} />
      </span>
      <span lang={tamilLang(text)} className="min-w-0 flex-1 break-words">
        {text}
      </span>
      {state === 'correct' && <FiCheck aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-emerald-400 p-1 text-white" />}
      {state === 'wrong' && <FiX aria-hidden className="h-8 w-8 shrink-0 rounded-full bg-slate-900/60 p-1 text-white" />}
    </button>
  )
}
