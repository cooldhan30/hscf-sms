import { createListHandlers } from '@/lib/settings/list-route-factory'

const { GET, POST: makePost } = createListHandlers('sms_email_templates', 'name')

export { GET }
export const POST = makePost({ key: 'string', name: 'string', subject: 'string', body: 'string' })
