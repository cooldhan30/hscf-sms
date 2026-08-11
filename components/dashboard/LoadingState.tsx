export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-500 dark:text-stone-400">
      <div className="w-8 h-8 rounded-full border-2 border-primary-200 dark:border-primary-900 border-t-primary-600 dark:border-t-primary-400 animate-spin" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}
