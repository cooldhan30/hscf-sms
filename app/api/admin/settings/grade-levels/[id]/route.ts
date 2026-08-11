import { createItemHandlers } from '@/lib/settings/list-route-factory'

const { PATCH: makePatch, DELETE } = createItemHandlers('sms_grade_levels')

export const PATCH = makePatch({ value: 'string', label: 'string', sort_order: 'number', is_active: 'boolean' })
export { DELETE }
