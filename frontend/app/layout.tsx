import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { RoleProvider } from './contexts/RoleContext'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Medius — Massachusetts Rental Dispute Resolution',
  description: 'AI-assisted dispute resolution for Massachusetts renters and landlords — humans make every decision.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <RoleProvider>
          {children}
        </RoleProvider>
      </body>
    </html>
  )
}
