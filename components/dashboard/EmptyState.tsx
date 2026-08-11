import { FiInbox } from 'react-icons/fi'
import type { IconType } from 'react-icons'

export function EmptyState({
  icon: Icon = FiInbox,
  title,
  description,
}: {
  icon?: IconType
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900">
      <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500 mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <p className="font-semibold text-stone-700 dark:text-stone-200">{title}</p>
      {description && (
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-sm">{description}</p>
      )}
    </div>
  )
}
