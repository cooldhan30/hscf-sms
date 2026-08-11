'use client'

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { FiBarChart2 } from 'react-icons/fi'

export interface ReportBarSeries {
  key: string
  label: string
  color: string
}

export function ReportBarChart({
  data,
  xKey,
  bars,
  height = 280,
}: {
  data: Record<string, string | number>[]
  xKey: string
  bars: ReportBarSeries[]
  height?: number
}) {
  if (data.length === 0) {
    return <EmptyState icon={FiBarChart2} title="No data for this range" />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-800" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} className="fill-stone-500 dark:fill-stone-400" />
        <YAxis tick={{ fontSize: 12 }} className="fill-stone-500 dark:fill-stone-400" allowDecimals={false} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 13 }}
          labelStyle={{ fontWeight: 600 }}
        />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
