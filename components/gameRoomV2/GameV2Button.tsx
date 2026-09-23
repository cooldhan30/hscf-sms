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
      primary:
        'bg-gamev2ink-700 text-white shadow-[0_4px_0_0_theme(colors.gamev2ink.900)] hover:bg-gamev2ink-600 active:shadow-[0_1px_0_0_theme(colors.gamev2ink.900)] dark:bg-gamev2ink-600 dark:shadow-[0_4px_0_0_theme(colors.gamev2ink.950)]',
      spark:
        'bg-gamev2spark-500 text-gamev2ink-950 shadow-[0_4px_0_0_theme(colors.gamev2spark.700)] hover:bg-gamev2spark-400 active:shadow-[0_1px_0_0_theme(colors.gamev2spark.700)]',
      ghost:
        'bg-white dark:bg-gamev2ink-900 text-gamev2ink-800 dark:text-gamev2ink-100 border-2 border-gamev2ink-200 dark:border-gamev2ink-700 hover:border-gamev2ink-400 dark:hover:border-gamev2ink-500',
      danger:
        'bg-gamev2coral-500 text-white shadow-[0_4px_0_0_theme(colors.gamev2coral.600)] hover:bg-gamev2coral-400 active:shadow-[0_1px_0_0_theme(colors.gamev2coral.600)]',
    }

    const sizeClasses = {
      md: 'px-5 py-3 text-base min-h-[48px]',
      lg: 'px-7 py-4 text-lg min-h-[56px]',
      xl: 'px-9 py-5 text-xl min-h-[64px]',
    }

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={disabled || reduced ? undefined : { y: -2 }}
        whileTap={disabled || reduced ? undefined : { y: 2 }}
        transition={spring}
        onClick={(e) => {
          if (sound) playSound('button', soundEnabled)
          onClick?.(e)
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gamev2spark-400 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)

GameV2Button.displayName = 'GameV2Button'
