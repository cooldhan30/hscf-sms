import { FiHardDrive, FiFolder, FiFileText, FiAward } from 'react-icons/fi'
import { StatCard } from '@/components/reports/StatCard'

export interface UploaderStat {
  profileId: string
  name: string
  count: number
  totalSize: number
}

export interface ClassStat {
  classId: string | null
  className: string
  count: number
  totalSize: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Admin-only overview above the resource grid: total storage split
// between the two Storage buckets this feature touches, who's actively
// contributing (a simple upload-count leaderboard), and where the bytes
// are going by class -- the numbers an admin actually needs to reason
// about scaling, not just browse files.
export function ResourceMetricsDashboard({
  resourceStorageBytes,
  assignmentImageStorageBytes,
  uploaders,
  classes,
}: {
  resourceStorageBytes: number
  assignmentImageStorageBytes: number
  uploaders: UploaderStat[]
  classes: ClassStat[]
}) {
  const totalBytes = resourceStorageBytes + assignmentImageStorageBytes
  const resourcePct = totalBytes > 0 ? Math.round((resourceStorageBytes / totalBytes) * 100) : 0
  const topUploaders = [...uploaders].sort((a, b) => b.count - a.count).slice(0, 8)
  const sortedClasses = [...classes].sort((a, b) => b.totalSize - a.totalSize)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Storage" value={formatBytes(totalBytes)} icon={FiHardDrive} tone="primary" />
        <StatCard label="Resources" value={formatBytes(resourceStorageBytes)} icon={FiFolder} tone="terracotta" />
        <StatCard label="Assignment Images" value={formatBytes(assignmentImageStorageBytes)} icon={FiFileText} tone="gold" />
        <StatCard label="Active Uploaders" value={uploaders.length} icon={FiAward} tone="primary" />
      </div>

      <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
        <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">Storage Split</p>
        <div className="h-3 rounded-full overflow-hidden bg-stone-100 dark:bg-stone-800 flex">
          <div className="bg-terracotta-500" style={{ width: `${resourcePct}%` }} />
          <div className="bg-gold-500" style={{ width: `${100 - resourcePct}%` }} />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-terracotta-500" /> Resources ({resourcePct}%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gold-500" /> Assignment Images ({100 - resourcePct}%)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">Top Uploaders</p>
          {topUploaders.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">No resources uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {topUploaders.map((u, i) => (
                <div key={u.profileId} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-stone-400 dark:text-stone-600 text-right">{i + 1}</span>
                  <span className="flex-1 text-sm text-stone-700 dark:text-stone-200 truncate">{u.name}</span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">{formatBytes(u.totalSize)}</span>
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-400 w-14 text-right">
                    {u.count} {u.count === 1 ? 'file' : 'files'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <p className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-3">By Class</p>
          {sortedClasses.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">No resources uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {sortedClasses.map((c) => (
                <div key={c.classId ?? 'all'} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-stone-700 dark:text-stone-200 truncate">{c.className}</span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">{formatBytes(c.totalSize)}</span>
                  <span className="text-sm font-semibold text-stone-600 dark:text-stone-300 w-14 text-right">
                    {c.count} {c.count === 1 ? 'file' : 'files'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
