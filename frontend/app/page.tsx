import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-blue-900 text-white py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <span className="inline-block bg-blue-700 text-blue-100 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
            Massachusetts Rental Disputes
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            You have rights as a renter.{' '}
            <span className="text-blue-300">We&apos;ll help you use them.</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            Medius guides you through your dispute in plain language — no lawyer required,
            no legalese, free to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/start"
              className="bg-white text-blue-900 font-semibold px-8 py-3 rounded-xl hover:bg-blue-50 transition-colors shadow-sm text-base"
            >
              Start my dispute →
            </Link>
            <Link
              href="/start?role=respondent"
              className="bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-600 transition-colors border border-blue-500 text-base"
            >
              I&apos;m a landlord →
            </Link>
          </div>
          <p className="text-blue-300 text-sm pt-1">
            Also available in Español · Français · 中文 · العربية + 6 more
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center space-y-3 p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-4xl">📝</div>
              <h3 className="text-base font-semibold text-gray-900">
                Tell us your story
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Answer guided yes/no questions. No writing paragraphs. Works without documents.
              </p>
            </div>
            <div className="text-center space-y-3 p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-4xl">⚖️</div>
              <h3 className="text-base font-semibold text-gray-900">
                Understand your rights
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Plain-language legal briefing at your reading level. Real Massachusetts statute citations.
              </p>
            </div>
            <div className="text-center space-y-3 p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="text-4xl">🤝</div>
              <h3 className="text-base font-semibold text-gray-900">
                Resolve together
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Send negotiation messages. AI rewrites hostile tone. You always choose what gets sent.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Lease analysis callout */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <h2 className="text-2xl font-bold text-gray-900">
            Is your lease even legal?
          </h2>
          <p className="text-gray-600 text-base max-w-xl mx-auto leading-relaxed">
            Upload your lease and we&apos;ll flag illegal clauses, missing disclosures, and your rights —
            in plain English.
          </p>
          <Link
            href="/start"
            className="inline-block bg-blue-600 text-white font-semibold px-7 py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Analyse a lease (demo)
          </Link>
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-white py-16 px-4 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-gray-400 mb-10">
            Built on trust
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { icon: '🔒', title: "AI didn't decide this", desc: 'Every outcome is chosen by the people in the dispute — not the AI.' },
              { icon: '📋', title: 'Your data is private', desc: 'We remove your name and address before the AI reads anything.' },
              { icon: '🚫', title: "We won't predict who wins", desc: 'No credibility scores. No win/loss predictions. Ever.' },
              { icon: '👤', title: 'Human mediator on standby', desc: 'A licensed mediator is available if you need one at any point.' },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center text-center space-y-2 p-4">
                <div className="text-3xl">{item.icon}</div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Medius — Massachusetts Rental Dispute Resolution</p>
          <p>Not legal advice. Information only.</p>
        </div>
      </footer>
    </main>
  )
}
