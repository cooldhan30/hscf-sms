export function SettingsCard({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-bold text-primary-900 dark:text-white">{title}</h3>
          {description && <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
