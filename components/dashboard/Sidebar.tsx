'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FiX } from 'react-icons/fi'

export interface SidebarItem {
  label: string
  href: string
  // Pre-rendered ReactNode (e.g. <FiHome />), not a component reference --
  // raw function components can't cross the Server -> Client Component
  // boundary when these items are built in a server layout.tsx.
  icon: React.ReactNode
}

function SidebarNav({
  items,
  activeHref,
  onNavigate,
}: {
  items: SidebarItem[]
  activeHref: string | undefined
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {items.map((item) => {
        const active = item.href === activeHref

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              active
                ? 'bg-primary-800 text-white'
                : 'text-stone-600 dark:text-stone-300 hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:text-primary-900 dark:hover:text-primary-200'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar({
  items,
  roleLabel,
  mobileOpen,
  onCloseMobile,
}: {
  items: SidebarItem[]
  roleLabel: string
  mobileOpen?: boolean
  onCloseMobile?: () => void
}) {
  const pathname = usePathname()

  // A route like `/student/grades` matches BOTH its own item and the
  // root `/student` "Dashboard" item under a plain startsWith check,
  // highlighting two nav items at once. Pick only the single
  // longest (most specific) matching href instead.
  const activeHref = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0]

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-64 flex-shrink-0 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 min-h-screen sticky top-0">
        <div className="px-6 py-6 border-b border-stone-200 dark:border-stone-800">
          <p className="text-lg font-bold text-primary-900 dark:text-white leading-tight">
            TSCF School
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400 mt-1">
            {roleLabel}
          </p>
        </div>
        <SidebarNav items={items} activeHref={activeHref} />
      </aside>

      {/* Mobile drawer: below `lg`, the sticky sidebar above is hidden
          entirely, so this is the only way to navigate between sections
          on a phone. Opened via TopNavigation's hamburger button. */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative flex flex-col w-72 max-w-[85vw] bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 h-full shadow-xl">
            <div className="flex items-center justify-between px-6 py-6 border-b border-stone-200 dark:border-stone-800">
              <div>
                <p className="text-lg font-bold text-primary-900 dark:text-white leading-tight">
                  TSCF School
                </p>
                <p className="text-xs font-semibold uppercase tracking-wide text-terracotta-600 dark:text-terracotta-400 mt-1">
                  {roleLabel}
                </p>
              </div>
              <button
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav items={items} activeHref={activeHref} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  )
}
