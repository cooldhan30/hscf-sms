'use client'

import { motion } from 'framer-motion'
import { forwardRef, ButtonHTMLAttributes } from 'react'

interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'
  > {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'right',
      fullWidth = false,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-300 focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group'

    const variantClasses = {
      primary:
        'bg-gradient-to-br from-primary-700 to-primary-800 text-white hover:shadow-teal hover:from-primary-800 hover:to-primary-900 active:scale-[0.98] focus:ring-4 focus:ring-primary-300 dark:from-primary-600 dark:to-primary-700 dark:focus:ring-primary-800',
      secondary:
        'bg-gradient-to-br from-terracotta-600 to-terracotta-700 text-white hover:shadow-terracotta hover:from-terracotta-700 hover:to-terracotta-800 active:scale-[0.98] focus:ring-4 focus:ring-terracotta-300 dark:from-terracotta-500 dark:to-terracotta-600 dark:focus:ring-terracotta-800',
      ghost:
        'bg-transparent text-primary-800 hover:bg-primary-100 hover:text-primary-900 dark:text-primary-300 dark:hover:bg-primary-950 focus:ring-4 focus:ring-primary-300',
      outline:
        'border-2 border-primary-700 text-primary-800 hover:bg-primary-50 hover:border-primary-800 dark:border-primary-400 dark:text-primary-300 dark:hover:bg-primary-950 focus:ring-4 focus:ring-primary-300',
    }

    const sizeClasses = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
      xl: 'px-10 py-5 text-xl',
    }

    return (
      <motion.button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
          fullWidth ? 'w-full' : ''
        } ${className}`}
        disabled={disabled}
        whileHover={{ scale: disabled ? 1 : 1.01 }}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        {...props}
      >
        {/* Shine effect on hover */}
        <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </span>

        {/* Content */}
        <span className="relative flex items-center gap-2">
          {icon && iconPosition === 'left' && (
            <motion.span
              initial={{ x: 0 }}
              whileHover={{ x: -3 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {icon}
            </motion.span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <motion.span
              initial={{ x: 0 }}
              whileHover={{ x: 3 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              {icon}
            </motion.span>
          )}
        </span>
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
