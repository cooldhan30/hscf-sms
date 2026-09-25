'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { useGameV2Motion } from './useGameV2Motion'
import { playSound } from './gameplay/playSound'
import { useSoundPreference } from './gameplay/useSoundPreference'

interface GameV2ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
  > {
  variant?: 'primary' | 'spark' | 'ghost' | 'danger'
  size?: 'md' | 'lg' | 'xl'
  fullWidth?: boolean
  // Opt-in, not default-on: GameV2Button is used everywhere in
  // GameRoom V2, including teacher/admin surfaces (Builder, Library,
  // confirm dialogs) where a click sound would be pure noise, not
  // "game feel." Only actual in-game/arcade screens (setup pickers,
  // HUD controls, victory/results actions) should pass `sound`.
  sound?: boolean
}

// The one button component every GameRoom V2 surface should use --
// deliberately chunkier and rounder than the main app's <Button>
// (components/ui/Button.tsx), tuned for a 6-17 age range: bigger touch
// targets (min 48px tall even at `md`), no subtlety in what's
// clickable, and a satisfying press animation instead of the main
// app's shine-sweep hover effect (that reads as "corporate SaaS", the
// explicit thing this design system is meant to avoid).
export const GameV2Button = forwardRef<HTMLButtonElement, GameV2ButtonProps>(
  ({ variant = 'primary', size = 'lg', fullWidth = false, className = '', disabled, sound = false, onClick, children, ...props }, ref) => {
    const { spring, reduced } = useGameV2Motion()
    const { soundEnabled } = useSoundPreference()

    const variantClasses = {
      // Same tokens as the main app's buttons (teal primary, stone-bordered
      // secondary) so GameRoom controls match the rest of the app.
      primary: 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700',
      spark: 'bg-primary-700 text-white hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-700',
      ghost:
        'bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800',
      danger: 'bg-red-600 text-white hover:bg-red-700',
    }

    const sizeClasses = {
      md: 'px-4 py-2.5 text-sm min-h-[44px]',
      lg: 'px-5 py-3 text-base min-h-[48px]',
      xl: 'px-6 py-3.5 text-lg min-h-[52px]',
    }

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileTap={disabled || reduced ? undefined : { scale: 0.98 }}
        transition={spring}
        onClick={(e) => {
          if (sound) playSound('button', soundEnabled)
          onClick?.(e)
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)

GameV2Button.displayName = 'GameV2Button'
