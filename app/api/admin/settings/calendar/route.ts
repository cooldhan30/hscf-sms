import { createListHandlers } from '@/lib/settings/list-route-factory'

const { GET, POST: makePost } = createListHandlers('sms_calendar_events', 'event_date')

export { GET }
export const POST = makePost({ title: 'string', event_date: 'string', end_date: 'string', description: 'string' })
