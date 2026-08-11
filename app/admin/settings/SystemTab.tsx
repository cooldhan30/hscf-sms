'use client'

import { useEffect, useState } from 'react'
import { FiDownload } from 'react-icons/fi'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { SelectField, TextField } from '@/components/settings/FormField'
import { ListManager } from '@/components/settings/ListManager'
import { Switch } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import type { SmsEmailTemplate, SmsNotificationSettings, SmsBackupSettings } from '@/types/database'

export function SystemTab() {
  const [templates, setTemplates] = useState<SmsEmailTemplate[]>([])
  const [notifSettings, setNotifSettings] = useState<SmsNotificationSettings | null>(null)
  const [backupSettings, setBackupSettings] = useState<SmsBackupSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const [notifForm, setNotifForm] = useState({ notify_email_enabled: true, notify_push_enabled: false, digest_frequency: 'immediate' })
  const [notifSaving, setNotifSaving] = useState(false)

  const [backupForm, setBackupForm] = useState({ auto_backup_enabled: false, backup_frequency: 'weekly', retention_days: '30' })
  const [backupSaving, setBackupSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function load() {
    const [templatesRes, notifRes, backupRes] = await Promise.all([
      fetch('/api/admin/settings/email-templates').then((r) => r.json()),
      fetch('/api/admin/settings/notifications').then((r) => r.json()),
      fetch('/api/admin/settings/backup').then((r) => r.json()),
    ])
    setTemplates(templatesRes.items ?? [])
    if (notifRes.item) {
      setNotifSettings(notifRes.item)
      setNotifForm({
        notify_email_enabled: notifRes.item.notify_email_enabled,
        notify_push_enabled: notifRes.item.notify_push_enabled,
        digest_frequency: notifRes.item.digest_frequency,
      })
    }
    if (backupRes.item) {
      setBackupSettings(backupRes.item)
      setBackupForm({
        auto_backup_enabled: backupRes.item.auto_backup_enabled,
        backup_frequency: backupRes.item.backup_frequency,
        retention_days: String(backupRes.item.retention_days),
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveNotifications() {
    setNotifSaving(true)
    const res = await fetch('/api/admin/settings/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifForm),
    })
    const data = await res.json().catch(() => ({}))
    setNotifSaving(false)
    if (res.ok) setNotifSettings(data.item)
  }

  async function saveBackupSettings() {
    setBackupSaving(true)
    const res = await fetch('/api/admin/settings/backup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupForm),
    })
    const data = await res.json().catch(() => ({}))
    setBackupSaving(false)
    if (res.ok) setBackupSettings(data.item)
  }

  async function downloadBackup() {
    setExporting(true)
    const res = await fetch('/api/admin/settings/backup/export')
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hscf-sms-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const refreshed = await fetch('/api/admin/settings/backup').then((r) => r.json())
      if (refreshed.item) setBackupSettings(refreshed.item)
    }
    setExporting(false)
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ListManager<SmsEmailTemplate>
        title="Email Templates"
        description="Editable content for future email notifications. No email provider is configured yet, so these templates aren't sent -- they're ready for once one is wired in."
        endpoint="/api/admin/settings/email-templates"
        rows={templates}
        onChanged={load}
        itemLabel={(t) => t.name}
        columns={[
          { header: 'Key', accessor: (t) => t.key },
          { header: 'Name', accessor: (t) => t.name },
          { header: 'Subject', accessor: (t) => t.subject },
        ]}
        fields={[
          { key: 'key', label: 'Key (e.g. welcome)', type: 'text', required: true },
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'subject', label: 'Subject', type: 'text', required: true },
          { key: 'body', label: 'Body', type: 'textarea', required: true },
        ]}
      />

      <SettingsCard title="Notification Settings" description="Global defaults for the announcement notification queue introduced in Phase 6.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Email notifications</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Queue email notifications when announcements are published.</p>
            </div>
            <Switch checked={notifForm.notify_email_enabled} onChange={(v) => setNotifForm({ ...notifForm, notify_email_enabled: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Push notifications</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Queue push notifications when announcements are published.</p>
            </div>
            <Switch checked={notifForm.notify_push_enabled} onChange={(v) => setNotifForm({ ...notifForm, notify_push_enabled: v })} />
          </div>
          <SelectField
            label="Digest Frequency"
            value={notifForm.digest_frequency}
            onChange={(v) => setNotifForm({ ...notifForm, digest_frequency: v })}
            options={[
              { value: 'immediate', label: 'Immediate' },
              { value: 'daily', label: 'Daily digest' },
              { value: 'weekly', label: 'Weekly digest' },
            ]}
          />
          <Button variant="primary" size="sm" onClick={saveNotifications} disabled={notifSaving}>
            {notifSaving ? 'Saving...' : 'Save'}
          </Button>
          {notifSettings && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Last updated: {new Date(notifSettings.updated_at).toLocaleString()}
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Backup Settings"
        description="Supabase already handles point-in-time recovery at the infrastructure level. This preference is informational; use Download Backup Now for a real on-demand export."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">Automatic backups</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Preference only -- no scheduler runs in this app yet.</p>
            </div>
            <Switch checked={backupForm.auto_backup_enabled} onChange={(v) => setBackupForm({ ...backupForm, auto_backup_enabled: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Frequency"
              value={backupForm.backup_frequency}
              onChange={(v) => setBackupForm({ ...backupForm, backup_frequency: v })}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
              ]}
            />
            <TextField
              label="Retention (days)"
              type="number"
              value={backupForm.retention_days}
              onChange={(v) => setBackupForm({ ...backupForm, retention_days: v })}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={saveBackupSettings} disabled={backupSaving}>
              {backupSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" size="sm" icon={<FiDownload />} onClick={downloadBackup} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Download Backup Now'}
            </Button>
          </div>
          {backupSettings?.last_backup_at && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Last backup: {new Date(backupSettings.last_backup_at).toLocaleString()}
            </p>
          )}
        </div>
      </SettingsCard>
    </div>
  )
}
