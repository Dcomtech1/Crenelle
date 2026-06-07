import type { Metadata } from 'next'
import { Cormorant_Garamond, Syne } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { SentryUserProvider } from '@/components/sentry-user-provider'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Crenelle — Event Access Management',
  description: 'Issue QR-coded entry passes, scan guests in real-time, and take full control of every door.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Crenelle — Event Access Management',
    description: 'Issue QR-coded entry passes, scan guests in real-time, and take full control of every door.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Crenelle — Event Access Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crenelle — Event Access Management',
    description: 'Issue QR-coded entry passes, scan guests in real-time, and take full control of every door.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${cormorant.variable} ${syne.variable} antialiased font-sans grain`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SentryUserProvider />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
