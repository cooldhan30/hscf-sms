'use client'

import { useEffect, useState } from 'react'
import { FiKey, FiShield, FiUserCheck, FiPlus, FiX } from 'react-icons/fi'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { SettingsCard } from '@/components/settings/SettingsCard'
import { Switch } from '@/components/ui/Switch'
import { useConfirm } from '@/components/ui/ConfirmDialogProvider'
import { toast } from '@/lib/toast'
import { Pagination } from '@/components/ui/Pagination'
import { usePagination } from '@/lib/hooks/usePagination'
import type { SmsProfile, SmsRole } from '@/types/database'

const ROLE_FILTERS: { key: SmsRole | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'admin', label: 'Admins' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'student', label: 'Students' },
  { key: 'parent', label: 'Parents' },
]

const ROLE_BADGE: Record<SmsRole, string> = {
  admin: 'bg-terracotta-100 text-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-300',
  teacher: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300',
  student: 'bg-gold-100 text-gold-800 dark:bg-gold-950 dark:text-gold-300',
  parent: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

const PERMISSIONS_MATRIX: { area: string; admin: string; teacher: string; student: string; parent: string }[] = [
  { area: 'Accounts & registrations', admin: 'Full', teacher: '—', student: '—', parent: '—' },
  { area: 'Classes & rosters', admin: 'Full', teacher: 'Own classes', student: 'Own enrollment', parent: 'Linked children' },
  { area: 'Attendance', admin: 'View all', teacher: 'Own classes', student: 'Own record', parent: 'Linked children' },
  { area: 'Grades', admin: 'View all', teacher: 'Own classes', student: 'Own grades', parent: 'Linked children' },
  { area: 'Announcements', admin: 'Any audience', teacher: 'Own grade/class', student: 'Read targeted', parent: 'Read targeted' },
  { area: 'Reports', admin: 'School-wide', teacher: 'Own classes', student: 'Own data', parent: 'Linked children' },
  { area: 'Settings', admin: 'Full', teacher: '—', student: '—', parent: '—' },
]

// Every role the account may act as. Falls back to the acting role alone
// for any response predating multi-role support.
type UserWithRoles = SmsProfile & { roles?: string[] }

// A student never gains a second role, and nobody becomes a student this
// way -- mirrors GRANTABLE_ROLES in the API, which is the real enforcement.
const GRANTABLE: readonly SmsRole[] = ['admin', 'teacher', 'parent']

export function UsersTab() {
  const confirm = useConfirm()
  const [role, setRole] = useState<SmsRole | 'all'>('all')
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [grantingId, setGrantingId] = useState<string | null>(null)
  const { page, setPage, pageCount, pageItems, total } = usePagination(users, 10)
  const [counts, setCounts] = useState({ admin: 0, teacher: 0, student: 0, parent: 0 })
  const [loading, setLoading] = useState(true)
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const params = role === 'all' ? '' : `?role=${role}`
    const res = await fetch(`/api/admin/settings/users${params}`).then((r) => r.json())
    setUsers(res.items ?? [])
    if (res.counts) setCounts(res.counts)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  async function toggleActive(user: SmsProfile, next: boolean) {
    const res = await fetch(`/api/admin/settings/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: next }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(next ? `${user.first_name} ${user.last_name} activated` : `${user.first_name} ${user.last_name} suspended`)
      load()
    } else {
      toast.error(data.error || 'Failed to update account status')
    }
  }

  async function handleApprove(user: SmsProfile, role: Exclude<SmsRole, 'pending'>) {
    setApprovingId(null)
    const res = await fetch(`/api/admin/settings/users/${user.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`${user.first_name} ${user.last_name} approved as ${role}`)
      load()
    } else {
      toast.error(data.error || 'Failed to approve account')
    }
  }

  async function grantRole(user: UserWithRoles, role: SmsRole) {
    setGrantingId(null)
    const res = await fetch(`/api/admin/settings/users/${user.id}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`${user.first_name} can now use the ${role} portal`)
      load()
    } else {
      toast.error(data.error || 'Failed to grant role')
    }
  }

  async function revokeRole(user: UserWithRoles, role: string) {
    const confirmed = await confirm({
      title: `Remove ${role} access?`,
      description:
        `${user.first_name} ${user.last_name} will no longer be able to switch into the ${role} portal. ` +
        `Their ${role} records are kept, so this can be granted again later.`,
      confirmLabel: 'Remove access',
      tone: 'danger',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/settings/users/${user.id}/roles?role=${role}`, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success(`${role} access removed`)
      load()
    } else {
      toast.error(data.error || 'Failed to remove role')
    }
  }

  async function handleResetPassword(user: SmsProfile) {
    const confirmed = await confirm({
      title: `Reset password for ${user.first_name} ${user.last_name}?`,
      description: 'A new temporary password will be generated and shown once.',
      confirmLabel: 'Generate Password',
    })
    if (!confirmed) return

    const res = await fetch(`/api/admin/settings/users/${user.id}/reset-password`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setResetResult({ email: user.email ?? '', tempPassword: data.tempPassword })
      toast.success('Temporary password generated')
    } else {
      toast.error(data.error || 'Failed to reset password')
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['admin', 'teacher', 'student', 'parent'] as const).map((r) => (
          <div key={r} className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
            <p className="text-xl font-bold text-stone-800 dark:text-stone-100">{counts[r]}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 capitalize">{r}s</p>
          </div>
        ))}
      </div>

      {resetResult && (
        <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">
              New temporary password for {resetResult.email}
            </p>
            <p className="text-sm font-mono text-primary-900 dark:text-primary-200 mt-1 select-all">{resetResult.tempPassword}</p>
            <p className="text-xs text-primary-700 dark:text-primary-400 mt-1">
              Share this with the user directly -- it will not be shown again.
            </p>
          </div>
          <button
            onClick={() => setResetResult(null)}
            className="text-xs text-primary-700 dark:text-primary-400 hover:underline flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <SettingsCard title="Accounts" description="Activate, suspend, or reset the password for any account.">
        <div className="flex gap-1 mb-4 flex-wrap">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setRole(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                role === f.key
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300'
                  : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={5} />
        ) : users.length === 0 ? (
          <EmptyState title="No accounts found" />
        ) : (
          <div>
          <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Name</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Email</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Role</th>
                  <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Active</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u) => (
                  <tr key={u.id} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-stone-800 dark:text-stone-100">
                      {u.first_name} {u.last_name}
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{u.email || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(u.roles ?? [u.role]).map((r) => (
                          <span
                            key={r}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              ROLE_BADGE[r as SmsRole]
                            }`}
                            title={r === u.role ? 'Currently acting as this role' : undefined}
                          >
                            {r}
                            {/* Only removable once there are two, and never
                                the role they are currently acting as. */}
                            {(u.roles ?? []).length > 1 && r !== u.role && (
                              <button
                                onClick={() => revokeRole(u, r)}
                                aria-label={`Remove ${r} access`}
                                className="hover:opacity-60 transition-opacity"
                              >
                                <FiX className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}

                        {/* Students are never offered an extra role. */}
                        {u.role !== 'pending' && u.role !== 'student' && (
                          grantingId === u.id ? (
                            <span className="inline-flex items-center gap-1">
                              {GRANTABLE.filter((r) => !(u.roles ?? [u.role]).includes(r)).map((r) => (
                                <button
                                  key={r}
                                  onClick={() => grantRole(u, r)}
                                  className="px-2 py-0.5 rounded-full text-xs font-medium capitalize text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                                >
                                  {r}
                                </button>
                              ))}
                              <button
                                onClick={() => setGrantingId(null)}
                                className="px-1.5 py-0.5 rounded-full text-xs text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            GRANTABLE.some((r) => !(u.roles ?? [u.role]).includes(r)) && (
                              <button
                                onClick={() => setGrantingId(u.id)}
                                aria-label="Add another role"
                                className="p-0.5 rounded-full text-stone-400 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                              >
                                <FiPlus className="w-3.5 h-3.5" />
                              </button>
                            )
                          )
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Switch checked={u.is_active} onChange={(next) => toggleActive(u, next)} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {u.role === 'pending' ? (
                        approvingId === u.id ? (
                          <div className="inline-flex items-center gap-1">
                            {(['admin', 'teacher', 'student', 'parent'] as const).map((r) => (
                              <button
                                key={r}
                                onClick={() => handleApprove(u, r)}
                                className="px-2 py-1 rounded-lg text-xs font-medium capitalize text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                              >
                                {r}
                              </button>
                            ))}
                            <button
                              onClick={() => setApprovingId(null)}
                              className="px-2 py-1 rounded-lg text-xs text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setApprovingId(u.id)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                          >
                            <FiUserCheck className="w-3 h-3" /> Assign Role
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                        >
                          <FiKey className="w-3 h-3" /> Reset Password
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={10} />
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Roles & Permissions"
        description="What each role can access. Roles are fixed at account creation and enforced by database-level security policies -- this is a reference, not an editable permission matrix."
        actions={<FiShield className="w-5 h-5 text-stone-400" />}
      >
        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50">
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Area</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Admin</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Teacher</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Student</th>
                <th className="text-left font-semibold text-stone-600 dark:text-stone-300 px-4 py-2.5">Parent</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS_MATRIX.map((row) => (
                <tr key={row.area} className="border-b border-stone-100 dark:border-stone-800/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-stone-800 dark:text-stone-100">{row.area}</td>
                  <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{row.admin}</td>
                  <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{row.teacher}</td>
                  <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{row.student}</td>
                  <td className="px-4 py-2.5 text-stone-500 dark:text-stone-400">{row.parent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  )
}
