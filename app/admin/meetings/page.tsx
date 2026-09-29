import { MeetingsList } from '@/components/meetings/MeetingsList'

export const dynamic = 'force-dynamic'

export default function AdminMeetingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Meetings</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Join the live meeting room for any of your classes. Rooms stay open with no end time.
        </p>
      </div>
      <MeetingsList />
    </div>
  )
}
