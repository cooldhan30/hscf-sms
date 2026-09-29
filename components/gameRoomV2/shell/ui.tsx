import Link from 'next/link'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import {
  FiHelpCircle,
  FiShield,
  FiZap,
  FiFlag,
  FiMap,
  FiScissors,
  FiNavigation,
  FiGrid,
  FiSearch,
  FiEdit3,
  FiLink,
  FiLayers,
  FiPlayCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiCircle,
  FiClock,
  FiSun,
  FiTruck,
  FiUmbrella,
  FiDroplet,
  FiMove,
  FiList,
  FiAward,
  FiCoffee,
  FiFeather,
  FiGift,
  FiHeadphones,
  FiHome,
  FiShoppingBag,
  FiSmile,
} from 'react-icons/fi'

// Shared building blocks for GameRoom application pages. Every class here
// is lifted from the existing app (app/student/page.tsx, app/teacher/*,
// components/dashboard/*): white/stone-900 rounded-2xl cards with a
// stone border, primary-900 headings, primary-700 links, stone-500 body
// text, and react-icons/fi -- no GameRoom-specific palette or gradients.

export const ENGINE_ICONS: Record<string, IconType> = {
  'classic-quiz': FiHelpCircle,
  'tower-defense': FiShield,
  'boss-battle': FiZap,
  racing: FiFlag,
  'treasure-quest': FiMap,
  'word-ninja': FiScissors,
  'space-mission': FiNavigation,
  'kingdom-builder': FiGrid,
  'mystery-mansion': FiSearch,
  crossword: FiEdit3,
  matching: FiLink,
  memory: FiLayers,
  'balloon-pop': FiSun,
  'letter-train': FiTruck,
  'parachute-catch': FiUmbrella,
  'fishing-pond': FiDroplet,
  'missing-letter': FiMove,
  'letter-parade': FiList,
  'frog-jump': FiSmile,
  'busy-bee': FiFeather,
  'dinosaur-egg': FiGift,
  'ice-cream-shop': FiCoffee,
  'treasure-hunt': FiAward,
  'build-a-house': FiHome,
  'sort-baskets': FiShoppingBag,
  'listen-choose': FiHeadphones,
}

export function engineIcon(engineId: string): IconType {
  return ENGINE_ICONS[engineId] ?? FiPlayCircle
}

export function PageHeader({
  title,
  tamilTitle,
  description,
  actions,
  backHref,
  backLabel,
}: {
  title: string
  tamilTitle?: string
  description?: string
  actions?: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="space-y-2">
      {backHref && (
        <Link href={backHref} className="inline-flex items-center gap-1.5 min-h-[40px] text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
          <FiArrowLeft className="w-4 h-4" aria-hidden /> {backLabel ?? 'Back'}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary-900 dark:text-white">{title}</h1>
          {tamilTitle && <p className="font-tamil text-lg leading-relaxed text-stone-600 dark:text-stone-300">{tamilTitle}</p>}
          {description && <p className="text-stone-500 dark:text-stone-400 mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 ${className}`}>{children}</div>
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: { href: string; label: string }
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-bold text-primary-900 dark:text-white">{title}</h2>
        {action && (
          <Link href={action.href} className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline flex-shrink-0">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </Card>
  )
}

export function StatCard({ icon: Icon, value, label }: { icon: IconType; value: ReactNode; label: string }) {
  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <Icon className="w-5 h-5 mb-3 text-primary-700 dark:text-primary-400" aria-hidden />
      <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</p>
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
    </div>
  )
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div
      className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary-600 dark:bg-primary-500" style={{ width: `${clamped}%` }} />
    </div>
  )
}

export type TopicStatusValue = 'new' | 'practicing' | 'mastered'

const STATUS_STYLE: Record<TopicStatusValue, { label: string; icon: IconType; classes: string }> = {
  new: { label: 'Not started', icon: FiCircle, classes: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  practicing: { label: 'Practicing', icon: FiClock, classes: 'bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-200' },
  mastered: { label: 'Mastered', icon: FiCheckCircle, classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
}

export function TopicStatusBadge({ status }: { status: TopicStatusValue }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${s.classes}`}>
      <s.icon className="w-3 h-3" aria-hidden /> {s.label}
    </span>
  )
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 first-letter:uppercase">
      {children}
    </span>
  )
}

export const primaryLinkButton =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-4 focus:ring-primary-300 dark:bg-primary-600 dark:hover:bg-primary-700'

export const secondaryLinkButton =
  'inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-4 focus:ring-primary-300'
