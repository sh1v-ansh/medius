import Link from 'next/link'
import { TrustLayer } from './components/trust/TrustLayer'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Medius</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/mediator" className="text-blue-600 hover:underline">
            Mediator Docket
          </Link>
        </nav>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <p className="text-lg text-gray-700">
            AI-assisted dispute resolution — humans make every decision.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            We help two people in a dispute understand the law and reach a resolution.
            The AI explains and organizes; you and the other party decide.
          </p>
        </div>

        <TrustLayer showAiBadge />
      </div>
    </main>
  )
}
