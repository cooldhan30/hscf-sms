import { createItemHandlers } from '@/lib/settings/list-route-factory'

const { PATCH: makePatch, DELETE } = createItemHandlers('sms_sections')

export const PATCH = makePatch({ name: 'string', sort_order: 'number', is_active: 'boolean' })
export { DELETE }
