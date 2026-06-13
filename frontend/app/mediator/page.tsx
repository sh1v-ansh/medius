'use client'

import { useEffect, useState } from 'react'
import { DocketTable, type CaseRow } from '../components/DocketTable'
import { RoleSwitcher } from '../components/RoleSwitcher'

export default function MediatorDocket() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/cases')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch cases')
        return r.json()
      })
      .then((data: CaseRow[]) => setCases(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Medius — Mediator Docket</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Cases sorted by triage priority (highest composite first)
          </p>
        </div>
        <RoleSwitcher />
      </header>

      <div className="p-6">
        {loading && (
          <p className="text-gray-500 text-sm py-8 text-center">Loading cases…</p>
        )}
        {error && (
          <p className="text-red-600 text-sm py-4">Error: {error}</p>
        )}
        {!loading && !error && <DocketTable cases={cases} />}
      </div>
    </main>
  )
}
