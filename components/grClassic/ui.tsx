'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { FiArrowLeft, FiGrid, FiHelpCircle, FiHome, FiLink2 } from 'react-icons/fi'
import type { IconType } from 'react-icons'
import type { GameType } from '@/lib/grClassic/types'

// GameRoom Classic UI kit. Its own look -- warm cream page, kolam-dot
// texture, chunky "pressable" buttons -- built from Tailwind's default
// palette only, so nothing here touches the shared tailwind config.

// band + bandText meet WCAG AA contrast (scripts/verify-grc-contrast.ts).
export const TYPE_META: Record<GameType, { label: string; ta: string; blurb: string; icon: IconType; band: string; bandText: string; soft: string; ring: string }> = {
  quiz: { label: 'Classic Quiz', ta: 'வினாடி வினா', blurb: 'Pick the right answer', icon: FiHelpCircle, band: 'bg-indigo-600', bandText: 'text-white', soft: 'bg-indigo-50 text-indigo-700', ring: 'ring-indigo-300' },
  match: { label: 'Match the Pairs', ta: 'பொருத்துக', blurb: 'Join each item to its partner', icon: FiLink2, band: 'bg-rose-600', bandText: 'text-white', soft: 'bg-rose-50 text-rose-700', ring: 'ring-rose-300' },
  'word-builder': { label: 'Word Builder', ta: 'சொல் அமை', blurb: 'Put letters or words in order', icon: FiGrid, band: 'bg-amber-400', bandText: 'text-amber-950', soft: 'bg-amber-50 text-amber-800', ring: 'ring-amber-300' },
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-3xl text-4xl' : 'h-10 w-10 rounded-2xl text-2xl'
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center bg-gradient-to-br from-rose-500 via-orange-400 to-amber-300 font-extrabold text-white shadow-[0_3px_0_0_#be123c] ${box}`}>
      த
    </span>
  )
}

export function Shell({ children, back, width = 'max-w-6xl' }: { children: ReactNode; back?: { href: string; label: string }; width?: string }) {
  return (
    <div className={`mx-auto w-full ${width} px-4 pb-16 sm:px-6`}>
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/gr-classic" className="flex min-w-0 items-center gap-3 rounded-2xl">
          <Logo />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-lg font-extrabold text-slate-900">தமிழி GameRoom Classic</span>
            <span className="block truncate text-xs font-semibold text-rose-700">விளையாடிக் கற்போம்!</span>
          </span>
        </Link>
        <Link href="/" className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-white/70">
          <FiHome aria-hidden /> <span className="hidden sm:inline">Portal</span>
        </Link>
      </header>
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-white/70">
          <FiArrowLeft aria-hidden /> {back.label}
        </Link>
      )}
      <main>{children}</main>
    </div>
  )
}

type Tone = 'primary' | 'teal' | 'indigo' | 'amber' | 'plain' | 'ghost'

const TONE: Record<Tone, string> = {
  primary: 'bg-rose-600 text-white shadow-[0_4px_0_0_#9f1239] hover:bg-rose-500',
  teal: 'bg-teal-700 text-white shadow-[0_4px_0_0_#134e4a] hover:bg-teal-600',
  indigo: 'bg-indigo-600 text-white shadow-[0_4px_0_0_#3730a3] hover:bg-indigo-500',
  amber: 'bg-amber-400 text-amber-950 shadow-[0_4px_0_0_#b45309] hover:bg-amber-300',
  plain: 'bg-white text-slate-800 ring-2 ring-slate-200 shadow-[0_4px_0_0_#e2e8f0] hover:bg-slate-50',
  ghost: 'text-slate-700 hover:bg-white/80',
}

const SIZE = { sm: 'px-3 py-2 text-sm rounded-xl', md: 'px-5 py-3 text-base rounded-2xl', lg: 'px-7 py-4 text-lg rounded-2xl' }

export function buttonClass(tone: Tone = 'primary', size: keyof typeof SIZE = 'md') {
  const press = tone === 'ghost' ? '' : 'active:translate-y-1 active:shadow-none'
  return `inline-flex items-center justify-center gap-2 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0 ${press} ${TONE[tone]} ${SIZE[size]}`
}

export function Button({ tone = 'primary', size = 'md', className = '', ...props }: ComponentProps<'button'> & { tone?: Tone; size?: keyof typeof SIZE }) {
  return <button type="button" className={`${buttonClass(tone, size)} ${className}`} {...props} />
}

export function ButtonLink({ tone = 'primary', size = 'md', className = '', ...props }: ComponentProps<typeof Link> & { tone?: Tone; size?: keyof typeof SIZE }) {
  return <Link className={`${buttonClass(tone, size)} ${className}`} {...props} />
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl bg-white shadow-[0_10px_30px_-14px_rgba(120,53,15,0.25)] ring-1 ring-amber-900/5 ${className}`}>{children}</div>
}

export function TypeChip({ type }: { type: GameType }) {
  const m = TYPE_META[type]
  const Icon = m.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.soft}`}>
      <Icon aria-hidden /> {m.label}
    </span>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const t = { slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-900', red: 'bg-rose-100 text-rose-800', blue: 'bg-sky-100 text-sky-800' }[tone]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${t}`}>{children}</span>
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-3 w-full overflow-hidden rounded-full bg-amber-900/10">
      <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400 transition-[width] duration-500" style={{ width: `${max ? (100 * value) / max : 0}%` }} />
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between gap-3">
      <h2 className="text-xl font-extrabold text-slate-900">{children}</h2>
      {action}
    </div>
  )
}

// Collapsed "Advanced options" -- optional settings stay out of the way.
export function Advanced({ children, summary }: { children: ReactNode; summary: string }) {
  return (
    <details className="group rounded-2xl bg-slate-50 ring-1 ring-slate-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold text-slate-700">
        <span>
          Advanced options <span className="block text-xs font-medium text-slate-500">{summary}</span>
        </span>
        <span aria-hidden className="text-slate-400 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-4 border-t border-slate-200 px-4 py-4">{children}</div>
    </details>
  )
}

export function Segmented<T extends string | number | null>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-bold text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold ring-2 transition ${o.value === value ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:ring-slate-300'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-bold text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-teal-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-teal-300" />
    </label>
  )
}

// "1 question", "5 questions", "1 board", "2 boards" (a Matching game's
// questions are boards of pairs).
export function countLabel(n: number, type: GameType): string {
  const word = type === 'match' ? 'board' : 'question'
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
