import type { Metadata } from 'next'
import { Bebas_Neue, DM_Mono } from 'next/font/google'

const bebasNeue = Bebas_Neue({ 
  weight: '400', 
  subsets: ['latin'],
  variable: '--font-display'
})

const dmMono = DM_Mono({ 
  weight: ['400', '500'], 
  subsets: ['latin'],
  variable: '--font-mono'
})

export const metadata: Metadata = {
  title: 'Event Registration — Crenelle',
  description: 'Register for an upcoming event.',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bebasNeue.variable} ${dmMono.variable} min-h-screen bg-background`}>
      {children}
    </div>
  )
}
