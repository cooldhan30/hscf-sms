'use client'

import { useState } from 'react'
import { Sidebar, type SidebarItem } from './Sidebar'
import { TopNavigation } from './TopNavigation'
import type { SmsRole } from '@/types/database'

export function DashboardLayout({
  roleLabel,
  navItems,
  userName,
  userRole,
  userAvatarUrl,
  availableRoles,
  children,
}: {
  roleLabel: string
  navItems: SidebarItem[]
  userName: string
  userRole: string
  userAvatarUrl?: string | null
  availableRoles?: SmsRole[]
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-stone-50 dark:bg-stone-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary-700 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar
        items={navItems}
        roleLabel={roleLabel}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopNavigation
          name={userName}
          role={userRole}
          avatarUrl={userAvatarUrl}
          availableRoles={availableRoles}
          onMenuClick={() => setMobileMenuOpen(true)}
        />
        <main id="main-content" className="flex-1 px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  )
}
