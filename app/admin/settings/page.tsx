import { SettingsClient } from './SettingsClient'

export const dynamic = 'force-dynamic'

export default function AdminSettingsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Settings</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          School information, user accounts, class taxonomy, and system configuration.
        </p>
      </div>
      <SettingsClient />
    </div>
  )
}
