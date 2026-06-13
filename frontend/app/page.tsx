import Link from 'next/link'

const FEATURES = [
  {
    icon: '📋',
    title: 'Lease Analysis',
    desc: 'Upload your lease. We flag every illegal clause and missing disclosure — with the exact Massachusetts statute that protects you.',
    tag: 'AI + Pinecone RAG',
    tagColor: 'bg-purple-100 text-purple-700',
  },
  {
    icon: '⚖️',
    title: 'Know Your Rights',
    desc: "Plain-language legal briefing at three reading levels. Basic, Intermediate, or Advanced \u2014 you choose what's readable for you.",
    tag: 'Gemini 2.5 Flash',
    tagColor: 'bg-blue-100 text-blue-700',
  },
  {
    icon: '🎙️',
    title: 'Speak in Any Language',
    desc: 'Record a voice message. Our speech model transcribes and translates — so you never have to struggle with English legalese.',
    tag: 'Speech-to-text',
    tagColor: 'bg-green-100 text-green-700',
  },
  {
    icon: '🤝',
    title: 'AI-Assisted Negotiation',
    desc: 'Type your message. AI rewrites hostile or unclear language into something calmer. You always choose what gets sent.',
    tag: 'Tone rewriting',
    tagColor: 'bg-amber-100 text-amber-700',
  },
  {
    icon: '🔬',
    title: 'Argument Analysis',
    desc: "Both sides\u2019 strongest arguments \u2014 steelmanned and checked for logical fallacies. Helps the mediator see both perspectives clearly.",
    tag: 'Fallacy detection',
    tagColor: 'bg-red-100 text-red-700',
  },
  {
    icon: '📊',
    title: 'Damage Range',
    desc: 'A statutory damage range both parties see — so negotiation starts from facts, not emotions.',
    tag: 'Shared anchor',
    tagColor: 'bg-slate-100 text-slate-700',
  },
]

const TRUST = [
  { icon: '🔒', title: 'AI never decides', desc: 'Outcomes are chosen by the people in the dispute. AI only informs.' },
  { icon: '🕵️', title: 'PII redacted', desc: 'Your name and address are removed before anything is processed.' },
  { icon: '🚫', title: 'No win predictions', desc: 'We never say who will win. This is information, not a verdict.' },
  { icon: '👤', title: 'Human mediator ready', desc: 'A licensed mediator reviews every escalated case.' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-900 tracking-tight">medius</span>
            <span className="hidden sm:inline text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/mediator" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
              Mediator view
            </Link>
            <Link
              href="/start"
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Start free →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-24 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.3),transparent_60%)]" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.06) 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Massachusetts Rental Disputes
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight">
            Legal help for renters{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              who can't afford lawyers
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Medius explains your lease, flags illegal clauses, and guides you through dispute resolution —
            in plain language, in your language, for free.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/start"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl transition-colors shadow-lg shadow-blue-900/40 text-base"
            >
              I'm a tenant — start my case →
            </Link>
            <Link
              href="/start?role=respondent"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-2xl transition-colors border border-white/20 text-base backdrop-blur"
            >
              I'm a landlord →
            </Link>
          </div>

          <p className="text-slate-500 text-sm">
            Available in English · Español · Français · 中文 · العربية · हिन्दी + more
          </p>
        </div>
      </section>

      {/* Stat strip */}
      <section className="bg-slate-900 border-y border-slate-800 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { num: '189+', label: 'MA statutes in database' },
            { num: '3', label: 'reading levels, you choose' },
            { num: '10+', label: 'languages supported' },
          ].map(({ num, label }) => (
            <div key={label}>
              <p className="text-3xl font-black text-blue-400">{num}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Process</p>
            <h2 className="text-3xl font-black text-slate-900">How Medius works</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            {[
              {
                step: '01',
                icon: '📝',
                title: 'Tell your story',
                desc: 'Answer guided questions. Speak instead of type. We work without documents too.',
              },
              {
                step: '02',
                icon: '⚖️',
                title: 'Understand your rights',
                desc: 'Get a plain-language legal briefing with real Massachusetts statute citations and lease analysis.',
              },
              {
                step: '03',
                icon: '🤝',
                title: 'Resolve your dispute',
                desc: 'Negotiate safely. AI rewrites hostility. A mediator reviews anything escalated.',
              },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="relative rounded-2xl bg-slate-50 border border-slate-200 p-8 space-y-4">
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{icon}</span>
                  <span className="text-4xl font-black text-slate-100 select-none">{step}</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">Features</p>
            <h2 className="text-3xl font-black text-slate-900">Everything you need</h2>
            <p className="text-slate-500 mt-3 text-base max-w-xl mx-auto">
              Built for people who've never talked to a lawyer — every tool explained in plain language.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon, title, desc, tag, tagColor }) => (
              <div
                key={title}
                className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{icon}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tagColor}`}>{tag}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lease analysis demo callout */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 p-8 sm:p-12 text-center space-y-6 border border-slate-700">
            <div className="inline-flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-red-300 text-xs font-semibold px-4 py-1.5 rounded-full">
              <span>⚠</span> Is your lease even legal?
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Most MA leases have at least one illegal clause.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-xl mx-auto">
              Landlords count on tenants not knowing their rights. Our AI flags illegal clauses,
              missing disclosures, and risky terms — free and in seconds.
            </p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-2xl transition-colors text-base"
            >
              Analyse my lease now →
            </Link>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="py-20 px-4 bg-slate-50 border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-12">
            Our commitments
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {TRUST.map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center space-y-2 p-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl">
                  {icon}
                </div>
                <p className="text-sm font-bold text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-white">medius</span>
            <span className="text-slate-600 text-sm">— Massachusetts Rental Dispute Resolution</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/mediator" className="hover:text-slate-300 transition-colors">Mediator portal</Link>
            <span>Information only — not legal advice</span>
          </div>
        </div>
      </footer>
    </main>
  )
}
