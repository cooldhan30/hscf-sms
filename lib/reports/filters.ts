import 'server-only'

export interface ReportFilterParams {
  academicYear: string | null
  startDate: string | null
  endDate: string | null
}

// Shared query-param parsing for every /api/*/reports/* route -- keeps the
// academicYear/startDate/endDate contract identical across all twelve
// report endpoints so the client-side ReportFilters component works the
// same way regardless of which report it's driving.
export function parseReportFilters(request: Request): ReportFilterParams {
  const { searchParams } = new URL(request.url)
  return {
    academicYear: searchParams.get('academicYear') || null,
    startDate: searchParams.get('startDate') || null,
    endDate: searchParams.get('endDate') || null,
  }
}

export const GRADE_BUCKETS = [
  { key: '0-59', label: '0-59%', min: 0, max: 59 },
  { key: '60-69', label: '60-69%', min: 60, max: 69 },
  { key: '70-79', label: '70-79%', min: 70, max: 79 },
  { key: '80-89', label: '80-89%', min: 80, max: 89 },
  { key: '90-100', label: '90-100%', min: 90, max: 100 },
] as const

export function bucketForPercentage(pct: number): (typeof GRADE_BUCKETS)[number]['key'] {
  const bucket = GRADE_BUCKETS.find((b) => pct >= b.min && pct <= b.max)
  return bucket?.key ?? '0-59'
}
