'use client'

import { useEffect, useState } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ListManager } from '@/components/settings/ListManager'
import type { SmsAcademicYear, SmsGradeLevelRow, SmsSection } from '@/types/database'

export function ClassesTab() {
  const [academicYears, setAcademicYears] = useState<SmsAcademicYear[]>([])
  const [gradeLevels, setGradeLevels] = useState<SmsGradeLevelRow[]>([])
  const [sections, setSections] = useState<SmsSection[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [yearsRes, gradesRes, sectionsRes] = await Promise.all([
      fetch('/api/admin/settings/academic-years').then((r) => r.json()),
      fetch('/api/admin/settings/grade-levels').then((r) => r.json()),
      fetch('/api/admin/settings/sections').then((r) => r.json()),
    ])
    setAcademicYears(yearsRes.items ?? [])
    setGradeLevels(gradesRes.items ?? [])
    setSections(sectionsRes.items ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-5">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ListManager<SmsAcademicYear>
        title="Academic Years"
        description="Manage the school years used across student and class records. Toggle 'Current' to switch which year is active."
        endpoint="/api/admin/settings/academic-years"
        rows={academicYears}
        onChanged={load}
        itemLabel={(y) => y.label}
        toggleField={{ key: 'is_current', label: 'Current' }}
        columns={[
          { header: 'Label', accessor: (y) => y.label },
          { header: 'Start', accessor: (y) => (y.start_date ? new Date(y.start_date).toLocaleDateString() : '—') },
          { header: 'End', accessor: (y) => (y.end_date ? new Date(y.end_date).toLocaleDateString() : '—') },
        ]}
        fields={[
          { key: 'label', label: 'Label (e.g. 2027-2028)', type: 'text', required: true },
          { key: 'start_date', label: 'Start Date', type: 'date' },
          { key: 'end_date', label: 'End Date', type: 'date' },
        ]}
      />

      <ListManager<SmsGradeLevelRow>
        title="Grade Levels"
        description="Reference list of grade levels available when creating classes and students."
        endpoint="/api/admin/settings/grade-levels"
        rows={gradeLevels}
        onChanged={load}
        itemLabel={(g) => g.label}
        toggleField={{ key: 'is_active', label: 'Active' }}
        columns={[
          { header: 'Value', accessor: (g) => g.value },
          { header: 'Label', accessor: (g) => g.label },
          { header: 'Order', accessor: (g) => g.sort_order },
        ]}
        fields={[
          { key: 'value', label: 'Value (e.g. grade-9)', type: 'text', required: true },
          { key: 'label', label: 'Label (e.g. Nilai 9)', type: 'text', required: true },
          { key: 'sort_order', label: 'Sort Order', type: 'number' },
        ]}
      />

      <ListManager<SmsSection>
        title="Sections"
        description="Optional class sections/divisions (e.g. Morning, Afternoon, Section A)."
        endpoint="/api/admin/settings/sections"
        rows={sections}
        onChanged={load}
        itemLabel={(s) => s.name}
        toggleField={{ key: 'is_active', label: 'Active' }}
        columns={[
          { header: 'Name', accessor: (s) => s.name },
          { header: 'Order', accessor: (s) => s.sort_order },
        ]}
        fields={[
          { key: 'name', label: 'Name', type: 'text', required: true },
          { key: 'sort_order', label: 'Sort Order', type: 'number' },
        ]}
      />
    </div>
  )
}
