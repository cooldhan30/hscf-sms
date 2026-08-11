'use client'

export interface ReportFilterValue {
  academicYear: string
  startDate: string
  endDate: string
}

export function ReportFilters({
  value,
  onChange,
  academicYears,
  showDateRange = true,
}: {
  value: ReportFilterValue
  onChange: (next: ReportFilterValue) => void
  academicYears: string[]
  showDateRange?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
      <div>
        <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">Academic Year</label>
        <select
          value={value.academicYear}
          onChange={(e) => onChange({ ...value, academicYear: e.target.value })}
          className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
        >
          <option value="">All years</option>
          {academicYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {showDateRange && (
        <>
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">From</label>
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ ...value, startDate: e.target.value })}
              className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">To</label>
            <input
              type="date"
              value={value.endDate}
              onChange={(e) => onChange({ ...value, endDate: e.target.value })}
              className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>
          {(value.startDate || value.endDate) && (
            <button
              onClick={() => onChange({ ...value, startDate: '', endDate: '' })}
              className="text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 underline underline-offset-2 pb-2"
            >
              Clear dates
            </button>
          )}
        </>
      )}
    </div>
  )
}
