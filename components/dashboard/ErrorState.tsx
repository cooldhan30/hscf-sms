import { FiAlertTriangle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'

export function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this. Please try again.",
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
      <span className="p-3 rounded-full bg-terracotta-100 dark:bg-terracotta-950 text-terracotta-600 dark:text-terracotta-400">
        <FiAlertTriangle className="w-6 h-6" />
      </span>
      <p className="font-semibold text-stone-800 dark:text-stone-100">{title}</p>
      <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  )
}
