import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Medius',
  description: 'AI-assisted dispute resolution',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
