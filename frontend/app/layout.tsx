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
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
              <Link
                href="/"
                className="flex items-center gap-2 font-bold text-lg text-blue-900 hover:text-blue-700 transition-colors"
              >
                <span className="text-blue-600 text-xl">⚖️</span>
                Medius
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <Link
                  href="/mediator"
                  className="text-gray-600 hover:text-blue-600 font-medium transition-colors"
                >
                  Mediator Docket
                </Link>
                <Link
                  href="/start"
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                  Start a dispute
                </Link>
              </div>
            </div>
          </nav>
          {children}
        </RoleProvider>
      </body>
    </html>
  )
}
