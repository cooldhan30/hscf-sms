import Link from 'next/link'
import { FiUser, FiUsers, FiBookOpen, FiClipboard, FiArrowRight, FiSpeaker } from 'react-icons/fi'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { RichTextContent } from '@/components/announcements/RichTextContent'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const supabase = createClient()
  const admin = createAdminClient()

  const [{ count: teacherCount }, { count: studentCount }, { count: classCount }, { count: pendingCount }, { data: activeAnnouncements }] =
    await Promise.all([
      supabase.from('sms_teachers').select('*', { count: 'exact', head: true }),
      supabase.from('sms_students').select('*', { count: 'exact', head: true }),
      supabase.from('sms_classes').select('*', { count: 'exact', head: true }),
      admin
        .from('website_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('registration_status', 'pending'),
      // Admin RLS sees every status, so filter explicitly to what's
      // actually live right now (published and not scheduled for later).
      supabase
        .from('sms_announcements')
        .select('*')
        .eq('status', 'published')
        .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

  const cards = [
    { label: 'Teachers', href: '/admin/teachers', icon: FiUser, count: teacherCount ?? 0 },
    { label: 'Students', href: '/admin/students', icon: FiUsers, count: studentCount ?? 0 },
    { label: 'Classes', href: '/admin/classes', icon: FiBookOpen, count: classCount ?? 0 },
    {
      label: 'Pending Registrations',
      href: '/admin/registrations',
      icon: FiClipboard,
      count: pendingCount ?? 0,
      highlight: (pendingCount ?? 0) > 0,
    },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-stone-500 dark:text-stone-400 mt-1">
          Manage accounts, registrations, and classes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={`group flex flex-col gap-3 p-5 rounded-2xl border transition-colors ${
              card.highlight
                ? 'border-terracotta-300 dark:border-terracotta-800 bg-terracotta-50 dark:bg-terracotta-950/30 hover:bg-terracotta-100 dark:hover:bg-terracotta-950/50'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <card.icon
                className={`w-5 h-5 ${
                  card.highlight ? 'text-terracotta-600 dark:text-terracotta-400' : 'text-primary-700 dark:text-primary-400'
                }`}
              />
              <FiArrowRight className="w-4 h-4 text-stone-300 dark:text-stone-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div>
              <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{card.count}</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary-900 dark:text-white flex items-center gap-2">
            <FiSpeaker className="w-5 h-5" /> Active Announcements
          </h2>
          <Link href="/admin/announcements" className="text-sm font-medium text-primary-700 dark:text-primary-400 hover:underline">
            View all
          </Link>
        </div>
        {!activeAnnouncements || activeAnnouncements.length === 0 ? (
          <EmptyState icon={FiSpeaker} title="No active announcements" />
        ) : (
          <div className="space-y-3">
            {activeAnnouncements.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-semibold text-stone-800 dark:text-stone-100">{a.title}</p>
                <RichTextContent html={a.body} className="text-stone-500 dark:text-stone-400 line-clamp-2" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
