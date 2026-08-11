import { createListHandlers } from '@/lib/settings/list-route-factory'

const { GET, POST: makePost } = createListHandlers('sms_sections', 'sort_order')

export { GET }
export const POST = makePost({ name: 'string', sort_order: 'number' })
