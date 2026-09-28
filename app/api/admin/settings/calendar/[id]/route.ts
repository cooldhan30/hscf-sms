import { createItemHandlers } from '@/lib/settings/list-route-factory'

const { PATCH: makePatch, DELETE } = createItemHandlers('sms_calendar_events')

export const PATCH = makePatch({ title: 'string', event_date: 'string', end_date: 'string', description: 'string', event_type: 'string' })
export { DELETE }
