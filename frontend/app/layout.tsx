import type { Metadata } from 'next'
import './globals.css'
import { RoleProvider } from './contexts/RoleContext'

export const metadata: Metadata = {
  title: 'Medius',
  description: 'AI-assisted dispute resolution',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RoleProvider>{children}</RoleProvider>
      </body>
    </html>
  )
}
