import type { SupabaseClient } from '@supabase/supabase-js'
import { parseDateOnly } from '@/lib/dates'

// School calendar (sms_calendar_events, migration 090): holidays, exam
// days and annual events, readable by every signed-in role and shown on
// the attendance calendars.

export type SchoolEventType = 'holiday' | 'exam' | 'event'

export interface SchoolDayEvent {
  title: string
  type: SchoolEventType
  description: string | null
}

// ISO date -> events on that day (multi-day events expanded day by day)
export type SchoolEventsByDate = Record<string, SchoolDayEvent[]>

interface CalendarEventRow {
  title: string
  event_date: string
  end_date: string | null
  event_type: SchoolEventType
  description: string | null
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function getSchoolEventsByDate(supabase: SupabaseClient): Promise<SchoolEventsByDate> {
  const { data } = await supabase
    .from('sms_calendar_events')
    .select('title, event_date, end_date, event_type, description')
    .order('event_date')
    .returns<CalendarEventRow[]>()

  const byDate: SchoolEventsByDate = {}
  for (const e of data ?? []) {
    const end = parseDateOnly(e.end_date ?? e.event_date)
    for (let d = parseDateOnly(e.event_date); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = isoOf(d)
      byDate[iso] = [...(byDate[iso] ?? []), { title: e.title, type: e.event_type ?? 'event', description: e.description }]
    }
  }
  return byDate
}

export function holidayOn(events: SchoolEventsByDate | undefined, iso: string): SchoolDayEvent | undefined {
  return events?.[iso]?.find((e) => e.type === 'holiday')
}

export const SCHOOL_EVENT_LABEL: Record<SchoolEventType, string> = {
  holiday: 'No school',
  exam: 'Exam',
  event: 'School event',
}
