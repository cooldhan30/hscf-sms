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
        // ===================================================
        // GAMEROOM V2 -- isolated palette, used only under
        // app/gameroom-v2 and components/gameRoomV2. Kept as its own
        // namespace (not a re-theme of primary/terracotta/gold) so the
        // rest of the app's admin/teacher/student/parent portals are
        // completely unaffected by any GameRoom V2 visual change --
        // adding these keys cannot alter any existing page, since
        // nothing outside gameRoomV2 references the `gamev2*` classes.
        //
        // Two hues carry the brand: a deep violet-blue night-sky ("V2
        // ink") for chrome/surfaces, and a warm marigold ("V2 spark")
        // for energy/reward -- a nod to temple-festival gold without
        // literal iconography. Game-specific accents (magenta, cyan,
        // lime) exist for per-engine identity (e.g. Racing = cyan,
        // Boss Battle = magenta) layered on top of this shared base.
        // =====================================================
        gamev2ink: {
          50: '#f4f5fb',
          100: '#e7e9f7',
          200: '#c9cdec',
          300: '#a3aade',
          400: '#7c85cc',
          500: '#5a63b8',
          600: '#454c9c',
          700: '#383d7d',
          800: '#2d3166',
          900: '#1f2247',
          950: '#13152e',
        },
        gamev2spark: {
          50: '#fffaeb',
          100: '#fef0c7',
          200: '#fde08a',
          300: '#fbc94d',
          400: '#f9b224',
          500: '#f2960c',
          600: '#d67607',
          700: '#b1560a',
          800: '#8f4310',
          900: '#753810',
        },
        gamev2coral: {
          400: '#ff6f7d',
          500: '#f8455a',
          600: '#dc2f47',
        },
        gamev2mint: {
          400: '#3ee6b0',
          500: '#16cf92',
          600: '#0eab78',
        },
        gamev2cyan: {
          400: '#3fd4f0',
          500: '#16b8dc',
          600: '#0f93b3',
        },
        gamev2magenta: {
          400: '#e968e0',
          500: '#cf42c7',
          600: '#a92ea3',
        },
        gamev2lime: {
          400: '#c3e64a',
          500: '#a3cc28',
          600: '#82a51e',
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
        // GameRoom V2 only (see the color block above for the
        // isolation rationale) -- a shared, gentle idle float for game
        // tiles/badges, distinct from the marketing-page `float` above
        // (smaller amplitude, tuned for a small tile, not a hero blob).
        'gamev2-idle-float': 'gamev2IdleFloat 4.5s ease-in-out infinite',
        'gamev2-pop-in': 'gamev2PopIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'gamev2-shake': 'gamev2Shake 0.4s ease-in-out',
        'gamev2-spark-burst': 'gamev2SparkBurst 0.6s ease-out',
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
        gamev2IdleFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        gamev2PopIn: {
          '0%': { opacity: '0', transform: 'scale(0.7)' },
          '70%': { opacity: '1', transform: 'scale(1.05)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        gamev2Shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        gamev2SparkBurst: {
          '0%': { opacity: '0', transform: 'scale(0.5) rotate(-8deg)' },
          '40%': { opacity: '1', transform: 'scale(1.15) rotate(4deg)' },
          '100%': { opacity: '0', transform: 'scale(1.4) rotate(0deg)' },
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
