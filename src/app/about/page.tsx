'use client';

import PageShell from '@/components/PageShell';
import { Hammer, Eye, Shield } from 'lucide-react';

const values = [
  {
    icon: Hammer,
    title: 'built by freelancers',
    desc: 'every feature is designed with lived freelance experience — not boardroom assumptions. we know what you need because we needed it too.',
  },
  {
    icon: Eye,
    title: 'radically transparent',
    desc: 'no hidden fees, no opaque algorithms, no shadowy pricing tiers. what you see is exactly what you get.',
  },
  {
    icon: Shield,
    title: 'privacy first',
    desc: 'your data belongs to you. we never sell it, never monetise it. full stop.',
  },
];

const team = [
  { initials: 'AK', name: 'aryan k.', role: 'founder & ceo' },
  { initials: 'MS', name: 'meera s.', role: 'lead engineer' },
  { initials: 'DR', name: 'dev r.', role: 'design lead' },
];

const avatarGradients = [
  'from-blue-600 to-sky-400',
  'from-indigo-600 to-blue-400',
  'from-sky-600 to-cyan-400',
];

export default function AboutPage() {
  return (
    <PageShell>
      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-28 md:py-36">
        {/* Background orbs */}
        <div
          className="pointer-events-none absolute -top-32 -left-40 w-[640px] h-[640px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute top-10 right-0 w-[480px] h-[480px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #1D4ED8 0%, transparent 70%)' }}
        />

        <div className="relative max-w-5xl mx-auto px-6 md:px-8 text-center">
          {/* Eyebrow */}
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide mb-8"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(135deg, rgba(29,78,216,0.10) 0%, rgba(59,130,246,0.10) 100%)',
              color: '#1D4ED8',
              border: '1px solid rgba(29,78,216,0.15)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            our story
          </span>

          <h1
            className="text-6xl md:text-7xl lg:text-8xl font-black text-[#0C1E36] dark:text-white leading-[1.05] mb-7"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
          >
            about{' '}
            <span className="gradient-text">rive.</span>
          </h1>

          <p
            className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            we are building the operating system for the future of freelance work.
          </p>
        </div>
      </section>

      {/* ── Mission ────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <div
            className="relative rounded-3xl p-10 md:p-16 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0C1E36 0%, #1e3a6a 100%)',
            }}
          >
            {/* Decorative corner circle */}
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 w-72 h-72 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)' }}
            />
            <div
              className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(29,78,216,0.20) 0%, transparent 70%)' }}
            />

            <span
              className="inline-block text-xs font-bold tracking-widest text-sky-400 mb-6 uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              our mission
            </span>

            <p
              className="relative text-xl md:text-2xl leading-relaxed text-slate-200 font-medium"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              freelancers power the modern economy — yet they&apos;re chronically underserved
              by tools built for enterprises. rive. exists to change that. one unified platform
              for projects, clients, payments, and ai — built by people who&apos;ve lived the
              freelance grind.
            </p>
          </div>
        </div>
      </section>

      {/* ── Values ─────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <span
              className="text-xs font-bold tracking-widest text-blue-600 uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              what we stand for
            </span>
            <h2
              className="mt-3 text-4xl md:text-5xl font-black text-[#0C1E36] dark:text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
            >
              our values
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-none p-8 flex flex-col gap-5 hover:-translate-y-1 transition-transform duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.10) 0%, rgba(59,130,246,0.12) 100%)' }}
                >
                  <Icon size={22} className="text-blue-600 dark:text-blue-400" strokeWidth={1.8} />
                </div>

                <div>
                  <h3
                    className="text-lg font-black text-[#0C1E36] dark:text-white mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-6 md:px-8">
          <div className="text-center mb-14">
            <span
              className="text-xs font-bold tracking-widest text-blue-600 uppercase"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              the people
            </span>
            <h2
              className="mt-3 text-4xl md:text-5xl font-black text-[#0C1E36] dark:text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
            >
              meet the team
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {team.map(({ initials, name, role }, idx) => (
              <div
                key={name}
                className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-none p-8 flex flex-col items-center gap-4 hover:-translate-y-1 transition-transform duration-300"
              >
                {/* Avatar */}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-black bg-gradient-to-br ${avatarGradients[idx]} shadow-lg`}
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  {initials}
                </div>
                <div className="text-center">
                  <p
                    className="font-black text-[#0C1E36] dark:text-white text-base"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {name}
                  </p>
                  <p
                    className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {role}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6 md:px-8 text-center">
          <h2
            className="text-4xl md:text-5xl font-black text-[#0C1E36] dark:text-white mb-5"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
          >
            ready to shape the future?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg" style={{ fontFamily: 'var(--font-body)' }}>
            be among the first to experience a platform truly built for freelancers.
          </p>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent('open-modal', { detail: 'waitlist' }))
            }
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-base hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/20 hover:-translate-y-px"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            join the waitlist
          </button>
        </div>
      </section>
    </PageShell>
  );
}
