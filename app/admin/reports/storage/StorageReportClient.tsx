'use client'

import { useMemo } from 'react'
import { FiHardDrive, FiFolder, FiFileText, FiMic } from 'react-icons/fi'
import { StatCard } from '@/components/reports/StatCard'
import { ReportTable, type ReportTableColumn } from '@/components/reports/ReportTable'
import { ExportButtons } from '@/components/reports/ExportButtons'

export interface ClassStorageRow {
  classId: string
  className: string
  resourceBytes: number
  assignmentBytes: number
}

export interface TeacherStorageRow {
  profileId: string
  name: string
  totalBytes: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const EXPORT_COLUMNS = [
  { header: 'Class', key: 'className' },
  { header: 'Resources', key: 'resources' },
  { header: 'Assignments (images + submissions)', key: 'assignments' },
  { header: 'Total', key: 'total' },
]

export function StorageReportClient({
  resourceBytes,
  assignmentImageBytes,
  submissionBytes,
  classes,
  uploaders,
}: {
  resourceBytes: number
  assignmentImageBytes: number
  submissionBytes: number
  classes: ClassStorageRow[]
  uploaders: TeacherStorageRow[]
}) {
  const assignmentBytes = assignmentImageBytes + submissionBytes
  const totalBytes = resourceBytes + assignmentBytes
  const resourcePct = totalBytes > 0 ? Math.round((resourceBytes / totalBytes) * 100) : 0
  const imagePct = totalBytes > 0 ? Math.round((assignmentImageBytes / totalBytes) * 100) : 0
  const submissionPct = Math.max(0, 100 - resourcePct - imagePct)

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => b.resourceBytes + b.assignmentBytes - (a.resourceBytes + a.assignmentBytes)),
    [classes]
  )
  const topUploaders = useMemo(() => [...uploaders].sort((a, b) => b.totalBytes - a.totalBytes).slice(0, 8), [uploaders])

  const exportRows = useMemo(
    () =>
      sortedClasses.map((c) => ({
        className: c.className,
        resources: formatBytes(c.resourceBytes),
        assignments: formatBytes(c.assignmentBytes),
        total: formatBytes(c.resourceBytes + c.assignmentBytes),
      })),
    [sortedClasses]
  )

  const columns: ReportTableColumn<ClassStorageRow>[] = [
    { header: 'Class', accessor: (r) => r.className },
    { header: 'Resources', accessor: (r) => formatBytes(r.resourceBytes), align: 'right' },
    { header: 'Assignments', accessor: (r) => formatBytes(r.assignmentBytes), align: 'right' },
    { header: 'Total', accessor: (r) => formatBytes(r.resourceBytes + r.assignmentBytes), align: 'right' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Storage" value={formatBytes(totalBytes)} icon={FiHardDrive} tone="primary" />
        <StatCard label="Resources" value={formatBytes(resourceBytes)} icon={FiFolder} tone="terracotta" />
        <StatCard label="Assignment Images" value={formatBytes(assignmentImageBytes)} icon={FiFileText} tone="gold" />
        <StatCard label="Student Submissions" value={formatBytes(submissionBytes)} icon={FiMic} tone="primary" />
      </div>

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Storage Split</p>
        <div className="h-3 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 flex">
          <div className="bg-terracotta-500" style={{ width: `${resourcePct}%` }} />
          <div className="bg-gold-500" style={{ width: `${imagePct}%` }} />
          <div className="bg-primary-500" style={{ width: `${submissionPct}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-terracotta-500" /> Resources ({resourcePct}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-500" /> Assignment Images ({imagePct}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500" /> Submissions ({submissionPct}%)
          </span>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Top Uploaders (Resources)</p>
        {topUploaders.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">No resources uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {topUploaders.map((u, i) => (
              <div key={u.profileId} className="flex items-center gap-3">
                <span className="w-5 text-xs font-bold text-stone-400 dark:text-stone-600 text-right">{i + 1}</span>
                <span className="flex-1 text-sm text-stone-700 dark:text-stone-200 truncate">{u.name}</span>
                <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">{formatBytes(u.totalBytes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300">By Class</p>
        <ExportButtons filename="storage-usage" title="Storage Usage Details" columns={EXPORT_COLUMNS} rows={exportRows} />
      </div>

      <ReportTable columns={columns} rows={sortedClasses} keyFor={(r) => r.classId} emptyTitle="No storage usage yet" />
    </div>
  )
}
