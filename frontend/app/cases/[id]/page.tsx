'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TrustLayer } from '../../components/trust/TrustLayer'

export default function CaseDetail() {
  const params = useParams()
  const caseId = params?.id as string

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <Link href="/mediator" className="text-sm text-blue-600 hover:underline">
          ← Back to docket
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-2">
          Case {caseId?.slice(0, 8)}…
        </h1>
      </header>
      <div className="p-6 max-w-3xl mx-auto">
        <TrustLayer showAiBadge />
      </div>
    </main>
  )
}
