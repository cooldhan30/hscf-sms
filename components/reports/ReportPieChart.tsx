'use client'

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { FiPieChart } from 'react-icons/fi'

export interface ReportPieSlice {
  key: string
  label: string
  value: number
  color: string
}

export function ReportPieChart({ data, height = 260 }: { data: ReportPieSlice[]; height?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return <EmptyState icon={FiPieChart} title="No data for this range" />
  }

  return (
    // Recharts' <Legend/> renders plain HTML spans with no explicit text
    // color, so it inherits from this wrapper -- without it, legend text
    // is invisible against a dark card background.
    <div className="text-stone-700 dark:text-stone-200">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {data.map((slice) => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 13, color: '#1c1917' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
