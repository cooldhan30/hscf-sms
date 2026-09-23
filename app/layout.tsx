import type { Metadata } from 'next'
import { Inter, Noto_Sans_Tamil } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialogProvider'

const inter = Inter({ subsets: ['latin'] })
// Self-hosted via next/font (no runtime request to Google Fonts, no
// extra dependency) so every `font-tamil` element -- GameRoom V2's
// question prompts/titles especially -- actually renders in a Tamil-
// tuned typeface instead of silently falling back to the OS's default
// Tamil font (or a boxes/tofu fallback where none is installed).
// Exposed as a CSS variable rather than swapped into `body` so it never
// changes any page that doesn't opt in via the `font-tamil` class.
const notoSansTamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-tamil',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'TSCF School Management System',
  description: 'School management portal for Tamil School Central Florida -- admin, teacher, student, and parent access.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      signInUrl="/tamizhi/login"
      signUpUrl="/tamizhi/sign-up"
      signInFallbackRedirectUrl="/tamizhi"
      signUpFallbackRedirectUrl="/tamizhi"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.className} ${notoSansTamil.variable}`}>
          <ThemeProvider>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            <ToastProvider />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
