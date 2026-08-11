import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialogProvider'

const inter = Inter({ subsets: ['latin'] })

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
        <body className={inter.className}>
          <ThemeProvider>
            <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
            <ToastProvider />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
