import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Primary: Tamil Teal (நீலம் - Neelam) - Enhanced for better contrast
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#0c4a42',
          950: '#042f2e',
        },
        // Secondary: Terracotta (செம்மண் - Semman)
        terracotta: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Accent: Sacred Gold (பொன் - Pon)
        gold: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        // Accent alias - matches gold, used throughout pages
        accent: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
      },
      fontFamily: {
        tamil: ['Noto Sans Tamil', 'sans-serif'],
      },
      boxShadow: {
        'xs': '0 1px 2px rgba(41, 37, 36, 0.05)',
        'sm': '0 2px 4px rgba(41, 37, 36, 0.06), 0 1px 2px rgba(41, 37, 36, 0.03)',
        'md': '0 4px 8px rgba(41, 37, 36, 0.08), 0 2px 4px rgba(41, 37, 36, 0.04)',
        'lg': '0 12px 24px rgba(41, 37, 36, 0.10), 0 4px 8px rgba(41, 37, 36, 0.06)',
        'xl': '0 20px 40px rgba(41, 37, 36, 0.12), 0 8px 16px rgba(41, 37, 36, 0.08)',
        '2xl': '0 24px 48px rgba(15, 118, 110, 0.15), 0 12px 24px rgba(15, 118, 110, 0.10)',
        'teal': '0 12px 24px rgba(15, 118, 110, 0.20), 0 6px 12px rgba(15, 118, 110, 0.15)',
        'terracotta': '0 8px 16px rgba(234, 88, 12, 0.20), 0 4px 8px rgba(234, 88, 12, 0.15)',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'float': 'float 6s ease-in-out infinite',
        'fade-up': 'fadeUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(30px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'entrance': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'exit': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
