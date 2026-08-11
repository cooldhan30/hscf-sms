'use client'

import { SignOutButton } from '@clerk/nextjs'
import { FiMenu, FiMoon, FiSun, FiLogOut, FiUser } from 'react-icons/fi'
import { useTheme } from '@/components/ThemeProvider'

export function TopNavigation({
  name,
  role,
  avatarUrl,
  onMenuClick,
}: {
  name: string
  role: string
  avatarUrl?: string | null
  onMenuClick?: () => void
}) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-white/90 dark:bg-stone-900/90 backdrop-blur border-b border-stone-200 dark:border-stone-800">
      <div className="flex items-center gap-3 lg:hidden">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="p-2 -ml-2 rounded-lg text-stone-500 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <FiMenu className="w-5 h-5" />
        </button>
        <span className="font-bold text-primary-900 dark:text-white">TSCF School</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-full text-stone-500 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          {theme === 'dark' ? <FiSun className="w-4 h-4" /> : <FiMoon className="w-4 h-4" />}
        </button>

        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-stone-200 dark:border-stone-800">
          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950 flex items-center justify-center text-primary-800 dark:text-primary-300 overflow-hidden">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- see AvatarUpload.tsx
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <FiUser className="w-4 h-4" />
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{name}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 capitalize">{role}</p>
          </div>
        </div>

        <SignOutButton redirectUrl="/tamizhi/login">
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-terracotta-700 dark:text-terracotta-300 hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </SignOutButton>
      </div>
    </header>
  )
}
