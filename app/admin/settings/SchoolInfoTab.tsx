'use client'

import { useEffect, useState } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { TextField, TextAreaField } from '@/components/settings/FormField'
import { ListManager } from '@/components/settings/ListManager'
import { Button } from '@/components/ui/Button'
import type { SmsSchoolSettings, SmsCalendarEvent } from '@/types/database'
import { formatDateOnly } from '@/lib/dates'

const EVENT_TYPE_OPTIONS = [
  { value: 'holiday', label: 'Holiday (no school -- marks attendance as Holiday)' },
  { value: 'exam', label: 'Exam day' },
  { value: 'event', label: 'School event' },
]
const EVENT_TYPE_LABEL: Record<string, string> = { holiday: 'Holiday', exam: 'Exam', event: 'Event' }

export function SchoolInfoTab() {
  const [settings, setSettings] = useState<SmsSchoolSettings | null>(null)
  const [form, setForm] = useState({ school_name: '', logo_url: '', contact_email: '', contact_phone: '', address: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [events, setEvents] = useState<SmsCalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [settingsRes, eventsRes] = await Promise.all([
      fetch('/api/admin/settings/school').then((r) => r.json()),
      fetch('/api/admin/settings/calendar').then((r) => r.json()),
    ])
    if (settingsRes.item) {
      setSettings(settingsRes.item)
      setForm({
        school_name: settingsRes.item.school_name ?? '',
        logo_url: settingsRes.item.logo_url ?? '',
        contact_email: settingsRes.item.contact_email ?? '',
        contact_phone: settingsRes.item.contact_phone ?? '',
        address: settingsRes.item.address ?? '',
      })
    }
    setEvents(eventsRes.items ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/admin/settings/school', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }
    setSettings(data.item)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SettingsCard title="School Details" description="Shown across the portal and used as the default academic year for new records.">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-terracotta-700 dark:text-terracotta-300 bg-terracotta-50 dark:bg-terracotta-950/40 border border-terracotta-200 dark:border-terracotta-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <TextField label="School Name" value={form.school_name} onChange={(v) => setForm({ ...form, school_name: v })} required />
          <TextField label="Logo URL" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} placeholder="https://..." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Contact Email" type="email" value={form.contact_email} onChange={(v) => setForm({ ...form, contact_email: v })} />
            <TextField label="Contact Phone" type="tel" value={form.contact_phone} onChange={(v) => setForm({ ...form, contact_phone: v })} />
          </div>
          <TextAreaField label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} rows={2} />
          <div>
            <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1.5">Current Academic Year</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {settings?.current_academic_year} — set from the Classes tab by marking an academic year as current.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            {saved && <span className="text-sm text-primary-700 dark:text-primary-400 font-medium">Saved</span>}
          </div>
        </form>
      </SettingsCard>

      <ListManager<SmsCalendarEvent>
        title="School Calendar"
        description="Holidays, exam dates, and other calendar events. Shown on every student, parent and teacher attendance calendar; adding a Holiday marks that day as Holiday for every enrolled student."
        endpoint="/api/admin/settings/calendar"
        rows={events}
        onChanged={load}
        itemLabel={(e) => e.title}
        columns={[
          { header: 'Title', accessor: (e) => e.title },
          { header: 'Type', accessor: (e) => EVENT_TYPE_LABEL[e.event_type] ?? e.event_type },
          { header: 'Date', accessor: (e) => formatDateOnly(e.event_date) },
          { header: 'End Date', accessor: (e) => (e.end_date ? formatDateOnly(e.end_date) : '—') },
          { header: 'Description', accessor: (e) => e.description || '—' },
        ]}
        fields={[
          { key: 'title', label: 'Title', type: 'text', required: true },
          { key: 'event_type', label: 'Type', type: 'select', options: EVENT_TYPE_OPTIONS, defaultValue: 'event' },
          { key: 'event_date', label: 'Date', type: 'date', required: true },
          { key: 'end_date', label: 'End Date (optional)', type: 'date' },
          { key: 'description', label: 'Description', type: 'textarea' },
        ]}
      />
    </div>
  )
}
