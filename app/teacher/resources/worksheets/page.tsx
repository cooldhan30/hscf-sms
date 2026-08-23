import { MyWorksheetsClient } from './MyWorksheetsClient'

export const dynamic = 'force-dynamic'

export default function MyWorksheetsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">My Worksheets</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">Worksheets you&apos;ve saved from the Worksheet Generator.</p>
      </div>

      <MyWorksheetsClient />
    </div>
  )
}
