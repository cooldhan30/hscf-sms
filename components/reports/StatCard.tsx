import type { IconType } from 'react-icons'

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string
  value: string | number
  icon: IconType
  tone?: 'primary' | 'terracotta' | 'gold'
}) {
  const toneClasses = {
    primary: 'text-primary-700 dark:text-primary-400',
    terracotta: 'text-terracotta-600 dark:text-terracotta-400',
    gold: 'text-gold-600 dark:text-gold-400',
  }[tone]

  return (
    <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <Icon className={`w-5 h-5 mb-3 ${toneClasses}`} />
      <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{value}</p>
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
    </div>
  )
}
