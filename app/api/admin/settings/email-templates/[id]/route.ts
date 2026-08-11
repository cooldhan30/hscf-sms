import { createItemHandlers } from '@/lib/settings/list-route-factory'

const { PATCH: makePatch, DELETE } = createItemHandlers('sms_email_templates')

export const PATCH = makePatch({ key: 'string', name: 'string', subject: 'string', body: 'string' })
export { DELETE }
