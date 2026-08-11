'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { FiTrendingUp } from 'react-icons/fi'

export interface ReportLineSeries {
  key: string
  label: string
  color: string
}

export function ReportLineChart({
  data,
  xKey,
  lines,
  height = 280,
  yDomain,
}: {
  data: Record<string, string | number>[]
  xKey: string
  lines: ReportLineSeries[]
  height?: number
  yDomain?: [number, number]
}) {
  if (data.length === 0) {
    return <EmptyState icon={FiTrendingUp} title="No data for this range" />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-stone-200 dark:stroke-stone-800" />
        <XAxis dataKey={xKey} tick={{ fontSize: 12 }} className="fill-stone-500 dark:fill-stone-400" />
        <YAxis tick={{ fontSize: 12 }} className="fill-stone-500 dark:fill-stone-400" domain={yDomain} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 13 }}
          labelStyle={{ fontWeight: 600 }}
        />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.label}
            stroke={l.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
