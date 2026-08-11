import { createListHandlers } from '@/lib/settings/list-route-factory'

const { GET, POST: makePost } = createListHandlers('sms_grade_levels', 'sort_order')

export { GET }
export const POST = makePost({ value: 'string', label: 'string', sort_order: 'number' })
