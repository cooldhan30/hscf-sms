'use client'

import { motion } from 'framer-motion'

interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'gold' | 'success' | 'neutral'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  pulse?: boolean
}

export function Badge({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  pulse = false,
}: BadgeProps) {
  const variantClasses = {
    primary:
      'bg-primary-600 text-white border border-primary-700 dark:bg-primary-950 dark:text-primary-200 dark:border-primary-900',
    secondary:
      'bg-terracotta-600 text-white border border-terracotta-700 dark:bg-terracotta-950 dark:text-terracotta-200 dark:border-terracotta-900',
    gold: 'bg-gold-500 text-stone-900 border border-gold-600 dark:bg-gold-950 dark:text-gold-200 dark:border-gold-900',
    success:
      'bg-emerald-600 text-white border border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900',
    neutral:
      'bg-stone-700 text-white border border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800',
  }

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${variantClasses[variant]} ${sizeClasses[size]} ${className} ${
        pulse ? 'animate-pulse' : ''
      }`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </motion.span>
  )
}
