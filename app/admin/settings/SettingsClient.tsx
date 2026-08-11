'use client'

import { useState } from 'react'
import { SchoolInfoTab } from './SchoolInfoTab'
import { UsersTab } from './UsersTab'
import { ClassesTab } from './ClassesTab'
import { SystemTab } from './SystemTab'

const TABS = [
  { key: 'school', label: 'School Information' },
  { key: 'users', label: 'Users' },
  { key: 'classes', label: 'Classes' },
  { key: 'system', label: 'System' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function SettingsClient() {
  const [tab, setTab] = useState<TabKey>('school')

  return (
    <div className="space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b border-stone-200 dark:border-stone-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'school' && <SchoolInfoTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'classes' && <ClassesTab />}
      {tab === 'system' && <SystemTab />}
    </div>
  )
}
