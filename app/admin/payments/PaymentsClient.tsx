'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiSearch, FiSend, FiMail, FiPhone, FiInfo } from 'react-icons/fi'
import { formatDistanceToNow } from 'date-fns'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { LoadingState } from '@/components/dashboard/LoadingState'
import { Switch } from '@/components/ui/Switch'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { toast } from '@/lib/toast'

interface PaymentRow {
  studentId: string
  studentName: string
  parentNames: string[]
  parentEmails: string[]
  parentPhones: string[]
  status: 'paid' | 'unpaid'
  lastRemindedAt: string | null
  reminderCount: number
}

export function PaymentsClient() {
  const confirm = useConfirm()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [academicYear, setAcademicYear] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyUnpaid, setOnlyUnpaid] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 200)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/payments')
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error || 'Could not load payments')
      return
    }
    setRows(data.items ?? [])
    setAcademicYear(data.academicYear ?? '')
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyUnpaid && r.status !== 'unpaid') return false
      if (!q) return true
      return (
        r.studentName.toLowerCase().includes(q) ||
        r.parentNames.some((n) => n.toLowerCase().includes(q)) ||
        r.parentEmails.some((e) => e.toLowerCase().includes(q))
      )
    })
  }, [rows, debouncedSearch, onlyUnpaid])

  const paidCount = rows.filter((r) => r.status === 'paid').length

  async function toggleStatus(row: PaymentRow, nextPaid: boolean) {
    const next = nextPaid ? 'paid' : 'unpaid'
    // Optimistic: the toggle should feel immediate on a list an admin is
    // working straight down. Reverted below if the write fails.
    setRows((prev) => prev.map((r) => (r.studentId === row.studentId ? { ...r, status: next } : r)))

    const res = await fetch(`/api/admin/payments/${row.studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setRows((prev) =>
        prev.map((r) => (r.studentId === row.studentId ? { ...r, status: row.status } : r))
      )
      toast.error(data.error || 'Could not update payment status')
    }
  }

  async function sendReminder(row: PaymentRow) {
    if (row.parentEmails.length === 0 && row.parentNames.length === 0) {
      toast.error(`${row.studentName} has no linked parent to remind`)
      return
    }

    const proceed = await confirm({
      title: `Send a fee reminder for ${row.studentName}?`,
      description:
        `${row.parentNames.join(', ') || 'Their parents'} will get an in-app notification. ` +
        `No email is sent yet -- no email provider is connected to this app.` +
        (row.reminderCount > 0 ? ` Already reminded ${row.reminderCount} time(s).` : ''),
      confirmLabel: 'Send reminder',
    })
    if (!proceed) return

    const res = await fetch(`/api/admin/payments/${row.studentId}/remind`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      toast.error(data.error || 'Could not send reminder')
      return
    }

    // Deliberately precise about what happened: an admin who believes an
    // email went out will stop chasing a parent who never heard anything.
    toast.success(
      data.notified > 0
        ? `Reminder sent in-app to ${data.notified} parent${data.notified === 1 ? '' : 's'}`
        : 'Reminder recorded, but no parent has an account to notify'
    )
    load()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2">
        <FiInfo className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Reminders are delivered as in-app notifications. Email delivery needs an email provider to be
          connected first &mdash; nothing is emailed today.
        </span>
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search student, parent, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-white focus:ring-2 focus:ring-primary-600 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={onlyUnpaid}
              onChange={(e) => setOnlyUnpaid(e.target.checked)}
              className="rounded border-stone-300 dark:border-stone-700"
            />
            Unpaid only
          </label>
          <p className="text-sm text-stone-500 dark:text-stone-400 whitespace-nowrap">
            {paidCount} / {rows.length} paid{academicYear && ` · ${academicYear}`}
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No students found"
          description={onlyUnpaid ? 'Everyone matching your search has paid.' : 'No active students yet.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                <Th>Student</Th>
                <Th>Parent</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Paid</Th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.studentId} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-stone-800 dark:text-stone-100 whitespace-nowrap">
                    {r.studentName}
                  </td>
                  <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300">
                    {r.parentNames.length > 0 ? r.parentNames.join(', ') : <Muted>No parent linked</Muted>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.parentEmails.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {r.parentEmails.map((e) => (
                          <a
                            key={e}
                            href={`mailto:${e}`}
                            className="inline-flex items-center gap-1.5 text-primary-700 dark:text-primary-300 hover:underline"
                          >
                            <FiMail className="w-3 h-3 flex-shrink-0" />
                            {e}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.parentPhones.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {r.parentPhones.map((p) => (
                          <a
                            key={p}
                            href={`tel:${p}`}
                            className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300 hover:underline whitespace-nowrap"
                          >
                            <FiPhone className="w-3 h-3 flex-shrink-0" />
                            {p}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.status === 'paid'}
                        onChange={(next) => toggleStatus(r, next)}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          r.status === 'paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-terracotta-700 dark:text-terracotta-400'
                        }`}
                      >
                        {r.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {/* Nothing to chase once they've paid. */}
                    {r.status === 'unpaid' && (
                      <button
                        onClick={() => sendReminder(r)}
                        title={
                          r.lastRemindedAt
                            ? `Last reminded ${formatDistanceToNow(new Date(r.lastRemindedAt), { addSuffix: true })}`
                            : 'No reminder sent yet'
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors whitespace-nowrap"
                      >
                        <FiSend className="w-3 h-3" />
                        {r.reminderCount > 0 ? `Remind again (${r.reminderCount})` : 'Send reminder'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5 whitespace-nowrap">
      {children}
    </th>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-stone-400 dark:text-stone-500">{children}</span>
}
