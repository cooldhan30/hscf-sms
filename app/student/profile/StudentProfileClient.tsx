'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClerk } from '@clerk/nextjs'
import { FiSave, FiCheck, FiUser } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import { GRADE_LEVEL_OPTIONS } from '@/lib/constants'
import type { SmsProfile, SmsStudent } from '@/types/database'

export function StudentProfileClient({ profile, student }: { profile: SmsProfile; student: SmsStudent }) {
  const router = useRouter()
  const { openUserProfile } = useClerk()

  // Contact info (phone/address) via our Route Handler
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [address, setAddress] = useState(profile.address ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [contactSaved, setContactSaved] = useState(false)

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault()
    setContactSaving(true)
    setContactError(null)
    setContactSaved(false)

    const res = await fetch('/api/student/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, address, avatarUrl }),
    })
    const data = await res.json().catch(() => ({}))
    setContactSaving(false)

    if (!res.ok) {
      setContactError(data.error || 'Something went wrong')
      return
    }

    setContactSaved(true)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Read-only info */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-3">
          School Record (read-only)
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-stone-400 dark:text-stone-500">Name</p>
            <p className="font-semibold text-stone-800 dark:text-stone-100">
              {student.first_name} {student.last_name}
            </p>
          </div>
          <div>
            <p className="text-stone-400 dark:text-stone-500">Grade Level</p>
            <p className="font-semibold text-stone-800 dark:text-stone-100">
              {GRADE_LEVEL_OPTIONS.find((g) => g.value === student.grade_level)?.label || student.grade_level || '—'}
            </p>
          </div>
          <div>
            <p className="text-stone-400 dark:text-stone-500">Academic Year</p>
            <p className="font-semibold text-stone-800 dark:text-stone-100">{student.academic_year}</p>
          </div>
          <div>
            <p className="text-stone-400 dark:text-stone-500">Status</p>
            <p className="font-semibold text-stone-800 dark:text-stone-100 capitalize">{student.enrollment_status}</p>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <form
        onSubmit={handleContactSubmit}
        className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Contact Info
        </p>
        <AvatarUpload currentUrl={avatarUrl} onUploaded={setAvatarUrl} />
        {contactError && (
          <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
            {contactError}
          </p>
        )}
        {contactSaved && (
          <p className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900 rounded-lg px-3 py-2">
            <FiCheck className="w-4 h-4" /> Contact info updated.
          </p>
        )}
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Phone</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>
        <Button type="submit" variant="primary" icon={<FiSave />} disabled={contactSaving}>
          {contactSaving ? 'Saving...' : 'Save Contact Info'}
        </Button>
      </form>

      {/* Account (Clerk-managed email/password) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Account
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">Current email: {profile.email}</p>
        <Button variant="secondary" icon={<FiUser />} onClick={() => openUserProfile()}>
          Manage Email &amp; Password
        </Button>
      </div>
    </div>
  )
}
