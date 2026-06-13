'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DocketTable, type CaseRow } from '../components/DocketTable'
import { listCases } from '../lib/api'

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-sm font-semibold mt-1">{label}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function MediatorDocket() {
  const [cases, setCases] = useState<CaseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadCases(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await listCases()
      setCases(data as unknown as CaseRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cases.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadCases() }, [])

  const totalCases = cases.length
  const activeCases = cases.filter((c) => c.status !== 'settled' && c.status !== 'escalated').length
  const escalatedCases = cases.filter((c) => c.status === 'escalated').length
  const settledCases = cases.filter((c) => c.status === 'settled').length

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 px-4 sm:px-6 py-6 border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 mb-2">
              ← Back to Medius
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white">Mediator Docket</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 font-semibold">
                Lawyer view
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Cases sorted by triage priority — highest composite score first
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => loadCases(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-600 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {refreshing ? <Spinner /> : <span aria-hidden="true">↻</span>}
              Refresh
            </button>
            <Link
              href="/start"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-500 transition-colors shadow-sm shadow-blue-900/40"
            >
              + New case
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Stats bar */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total cases" value={totalCases} color="bg-white border-slate-200 text-slate-900" />
            <StatCard label="Active" value={activeCases} sub="in progress" color="bg-blue-50 border-blue-200 text-blue-900" />
            <StatCard label="Escalated" value={escalatedCases} sub="needs lawyer" color="bg-red-50 border-red-200 text-red-900" />
            <StatCard label="Settled" value={settledCases} sub="resolved" color="bg-emerald-50 border-emerald-200 text-emerald-900" />
          </div>
        )}

        {/* Cases table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">All Cases</h2>
            {!loading && !error && cases.length > 0 && (
              <span className="text-xs text-slate-400">{cases.length} case{cases.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
              <Spinner />
              <span className="text-sm">Loading cases…</span>
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center space-y-4">
              <p className="text-red-600 text-sm font-semibold">Failed to load cases</p>
              <p className="text-red-500 text-sm">{error}</p>
              <button type="button" onClick={() => loadCases()} className="text-sm text-blue-600 hover:underline">
                Try again
              </button>
            </div>
          ) : cases.length === 0 ? (
            <div className="py-20 px-6 text-center space-y-4">
              <div className="text-5xl">📭</div>
              <div>
                <p className="text-slate-700 font-semibold">No cases yet</p>
                <p className="text-sm text-slate-400 mt-1">Cases appear here once parties start disputes through Medius.</p>
              </div>
              <Link href="/start" className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                Start a new case
              </Link>
            </div>
          ) : (
            <DocketTable cases={cases} />
          )}
        </div>

        {/* Mediator note */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-800">
          <strong className="font-bold">Mediator instructions:</strong> Click any case to open the full workspace with steelman
          arguments (including fallacy detection), damage ranges, common ground analysis, and escalation controls.
          Each row links to the neutral mediator perspective (
          <code className="text-xs bg-amber-100 px-1.5 py-0.5 rounded font-mono">?party=neutral</code>).
        </div>
      </div>
    </main>
  )
}
