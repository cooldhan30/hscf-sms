'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiSave, FiCheck } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { AvatarUpload } from '@/components/profile/AvatarUpload'
import type { SmsProfile, SmsTeacher } from '@/types/database'

export function ProfileClient({ profile, teacher }: { profile: SmsProfile; teacher: SmsTeacher }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(profile.first_name)
  const [lastName, setLastName] = useState(profile.last_name)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [subjectSpecialty, setSubjectSpecialty] = useState(teacher.subject_specialty ?? '')
  const [bio, setBio] = useState(teacher.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/teacher/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        avatarUrl,
        subjectSpecialty,
        bio,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6 space-y-4"
    >
      {error && (
        <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 text-sm text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900 rounded-lg px-3 py-2">
          <FiCheck className="w-4 h-4" /> Profile updated.
        </p>
      )}

      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">Personal</p>
      <AvatarUpload currentUrl={avatarUrl} onUploaded={setAvatarUrl} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name" value={firstName} onChange={setFirstName} required />
        <Field label="Last Name" value={lastName} onChange={setLastName} required />
      </div>
      <Field label="Email" value={profile.email ?? ''} onChange={() => {}} disabled />
      <Field label="Phone" value={phone} onChange={setPhone} />

      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400 pt-2">
        Professional
      </p>
      <Field label="Subject Specialty" value={subjectSpecialty} onChange={setSubjectSpecialty} />
      <div>
        <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        />
      </div>

      <Button type="submit" variant="primary" icon={<FiSave />} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  disabled?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent disabled:opacity-60"
      />
    </div>
  )
}
