'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DocketTable, type CaseRow } from '../components/DocketTable'
import { listCases } from '../lib/api'

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-blue-600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  )
}

export default function MediatorDocket() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadCases(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await listCases()
      // Cast to CaseRow[] — api.ts CaseData is compatible
      setCases(data as unknown as CaseRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [])

  const totalCases = cases.length
  const activeCases = cases.filter(
    (c) => c.status !== 'settled' && c.status !== 'escalated',
  ).length
  const escalatedCases = cases.filter((c) => c.status === 'escalated').length
  const settledCases = cases.filter((c) => c.status === 'settled').length

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm text-blue-600 hover:underline"
              >
                ← Back to Medius
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">Mediator Docket</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Cases sorted by triage priority (highest composite score first)
            </p>
          </div>
          <Link
            href="/start"
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
          >
            + New case
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats bar */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total cases"
              value={totalCases}
              color="bg-white border-gray-200 text-gray-900"
            />
            <StatCard
              label="Active"
              value={activeCases}
              color="bg-blue-50 border-blue-200 text-blue-900"
            />
            <StatCard
              label="Escalated"
              value={escalatedCases}
              color="bg-red-50 border-red-200 text-red-900"
            />
            <StatCard
              label="Settled"
              value={settledCases}
              color="bg-green-50 border-green-200 text-green-900"
            />
          </div>
        )}

        {/* Cases table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">All cases</h2>
            <button
              type="button"
              onClick={() => loadCases(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {refreshing ? <Spinner /> : <span aria-hidden="true">↻</span>}
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
              <Spinner />
              <span className="text-sm">Loading cases…</span>
            </div>
          ) : error ? (
            <div className="py-12 px-6 text-center space-y-4">
              <p className="text-red-600 text-sm font-medium">Failed to load cases</p>
              <p className="text-red-500 text-sm">{error}</p>
              <button
                type="button"
                onClick={() => loadCases()}
                className="text-sm text-blue-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : cases.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-4">
              <div className="text-5xl">📭</div>
              <div>
                <p className="text-gray-700 font-medium">No cases yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Cases will appear here once parties start disputes through Medius.
                </p>
              </div>
              <Link
                href="/start"
                className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                Start a new case
              </Link>
            </div>
          ) : (
            <DocketTable cases={cases} />
          )}
        </div>

        {/* Mediator note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          <strong>Mediator view:</strong> Click any case to open the full case view with steelman
          arguments, damage ranges, common ground analysis, and escalation controls. Each case row
          links to{' '}
          <code className="text-xs bg-amber-100 px-1 py-0.5 rounded font-mono">
            /cases/[id]?party=neutral
          </code>{' '}
          for the neutral mediator perspective.
        </div>
      </div>
    </main>
  )
}
