'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiAlertCircle } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { roleHomePath } from '@/lib/role-home-path'
import type { SmsRole } from '@/types/database'

const ROLE_OPTIONS: { value: Exclude<SmsRole, 'admin' | 'pending'>; label: string }[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
]

export function CompleteProfileForm({
  defaultFirstName,
  defaultLastName,
}: {
  defaultFirstName: string
  defaultLastName: string
}) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(defaultFirstName)
  const [lastName, setLastName] = useState(defaultLastName)
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]['value']>('parent')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/me/complete-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, firstName, lastName }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      return
    }

    router.push(roleHomePath(data.role))
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-left">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 text-terracotta-700 dark:text-terracotta-300 px-4 py-3 text-sm">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">First name</label>
          <input
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Last name</label>
          <input
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">I am a...</label>
        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRole(opt.value)}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                role === opt.value
                  ? 'bg-primary-100 dark:bg-primary-950 border-primary-300 dark:border-primary-800 text-primary-800 dark:text-primary-300'
                  : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Button type="submit" variant="primary" fullWidth disabled={loading}>
        {loading ? 'Saving...' : 'Continue'}
      </Button>
    </form>
  )
}
