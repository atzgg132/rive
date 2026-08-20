'use client';

import { Button } from "@/components/ui";
import PageShell from '@/components/PageShell';
import { Hammer, Eye, Shield } from 'lucide-react';
import { useRouter } from "next/navigation";

const values = [
  {
    icon: Hammer,
    title: 'Built from real client work',
    desc: 'Every feature is grounded in the realities of selling, delivering, and operating a digital service business.',
  },
  {
    icon: Eye,
    title: 'Radically transparent',
    desc: 'No hidden fees, no opaque algorithms, no shadowy pricing tiers. What you see is exactly what you get.',
  },
  {
    icon: Shield,
    title: 'Privacy first',
    desc: 'Your data belongs to you. We never sell it, never monetise it. Full stop.',
  },
];

const team = [
  {
    initials: 'AB',
    name: 'Arnav Bhattacharya',
    role: 'Founder · Product & Engineering',
    bio: 'Software engineer and builder based in Bengaluru, creating Rive—an operating workspace for managing clients, projects, revenue, expenses, and business development in one place. Arnav works across full-stack product development, payments, APIs, databases, and systems operations, with a focus on practical, dependable business software.',
  },
  {
    initials: 'AC',
    name: 'Agnik Chakravorty',
    role: 'Cofounder · Markets, ops & community',
    bio: 'Agnik brings a people-first lens to markets, operations, and community. He has analyzed markets, researched cloud adoption, managed vendors across hospitality businesses, and reduced travel transport costs by 18% through smarter routing. Bloomberg certified, he balances the team’s numbers side with a deep understanding of how people and businesses actually operate.',
  },
  {
    initials: 'DB',
    name: 'Druhin Basu',
    role: 'Cofounder · Strategy & growth',
    bio: 'Druhin is a business strategist, case writer, and storyteller who looks at companies from the inside out. He built an investor CRM and led cold outreach, tiering, and market mapping for a fintech fundraising process. With competition wins against leading business-school teams and experience speaking to trust-driven categories, he brings structure and clarity to rive.’s growth.',
  },
];

const avatarGradients = [
  'from-blue-600 to-sky-400',
  'from-indigo-600 to-blue-400',
  'from-sky-600 to-cyan-400',
];

export default function AboutPage() {
  const router = useRouter();
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
            Our story
          </span>

          <h1
            className="text-6xl md:text-7xl lg:text-8xl font-black text-foreground dark:text-white leading-[1.05] mb-7"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
          >
            About{' '}
            <span className="gradient-text">rive.</span>
          </h1>

          <p
            className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            We are building the operating system for modern service businesses.
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
              Our mission
            </span>

            <p
              className="relative text-xl md:text-2xl leading-relaxed text-slate-200 font-medium"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Digital service businesses create enormous value, yet their operations are still
              fragmented across generic tools and spreadsheets. Rive exists to change that: one
              connected platform for clients, projects, finances, planning, and growth—without
              enterprise complexity.
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
              What we stand for
            </span>
            <h2
              className="mt-3 text-4xl md:text-5xl font-black text-foreground dark:text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
            >
              Our values
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
                    className="text-lg font-black text-foreground dark:text-white mb-2"
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
              The people
            </span>
            <h2
              className="mt-3 text-4xl md:text-5xl font-black text-foreground dark:text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
            >
              Meet the team
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {team.map(({ initials, name, role, bio }, idx) => (
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
                    className="font-black text-foreground dark:text-white text-base"
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
                <p
                  className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed text-left"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-6 md:px-8 text-center">
          <h2
            className="text-4xl md:text-5xl font-black text-foreground dark:text-white mb-5"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.025em' }}
          >
            Ready to shape the future?
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-10 text-lg" style={{ fontFamily: 'var(--font-body)' }}>
            Be among the first to experience a platform built for serious client work.
          </p>
          <Button
            onClick={() =>
              router.push("/register")
            }
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-base hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/20 hover:-translate-y-px"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Create a free account
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
