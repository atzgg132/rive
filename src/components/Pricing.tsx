"use client";

import { Check, Zap } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "Free",
    priceNote: "Forever",
    description: "For freelancers just getting started.",
    features: [
      "Up to 3 active projects",
      "Basic client management",
      "Income & expense tracking",
      "Gig Board access (view only)",
      "1 portfolio page",
    ],
    cta: "join the waitlist",
    ctaStyle: "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/50",
    highlighted: false,
    checkColor: "text-slate-400 dark:text-slate-500",
  },
  {
    name: "Pro",
    price: "$19",
    priceNote: "/month",
    description: "For serious freelancers ready to scale.",
    features: [
      "Unlimited projects & clients",
      "Full AI co-pilot access",
      "Revenue & invoice management",
      "Gig Board posting + AI matches",
      "Agreement signing",
      "Customizable portfolio",
      "Lead Gen Assistant",
    ],
    cta: "get pro access",
    ctaStyle:
      "bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 shadow-lg shadow-blue-600/20",
    highlighted: true,
    checkColor: "text-blue-600 dark:text-blue-400",
  },
  {
    name: "Agency",
    price: "$49",
    priceNote: "/month",
    description: "For small teams and boutique agencies.",
    features: [
      "Everything in Pro",
      "Multi-seat workspace",
      "Advanced revenue analytics",
      "Priority AI co-pilot queue",
      "White-label invoice branding",
      "Dedicated support",
    ],
    cta: "talk to sales",
    ctaStyle: "border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50/50 dark:hover:bg-slate-800/50",
    highlighted: false,
    checkColor: "text-slate-400 dark:text-slate-500",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative bg-[#F5F8FC] dark:bg-[#0B1120] py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-100/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-8 relative">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5">
            <Zap className="w-3 h-3 shrink-0" />
            <span style={{ fontFamily: "var(--font-body)" }}>Simple, transparent pricing</span>
          </div>
          <h2
            className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-5 tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Invest in your business. <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)",
              }}
            >
              Pay back in 1 gig.
            </span>
          </h2>
          <p
            className="text-slate-600 dark:text-slate-300 text-lg max-w-xl mx-auto font-normal leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Choose the plan that fits where you are today. Upgrade or downgrade anytime.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-blue-900/20 ${
                plan.highlighted
                  ? "border-blue-200 dark:border-blue-800/80 bg-gradient-to-b from-blue-50/20 to-white dark:from-blue-950/40 dark:to-slate-900 shadow-xl dark:shadow-none pt-10 px-7 pb-7"
                  : "p-7"
              }`}
            >
              {/* Popular badge */}
              {plan.highlighted && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 text-white text-[11px] font-bold shadow-lg whitespace-nowrap">
                  <Zap className="w-3 h-3" />
                  Most Popular
                </div>
              )}

              {/* Plan name + description */}
              <div className="mb-6">
                <h3
                  className="text-slate-800 dark:text-white font-bold text-lg mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-slate-400 dark:text-slate-400 text-sm mb-5 font-medium"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {plan.description}
                </p>
                <div className="flex items-end gap-0.5">
                  <span
                    className="text-5xl font-bold text-slate-800 dark:text-white leading-none"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-slate-500 dark:text-slate-400 text-sm ml-1 mb-1 font-medium"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {plan.priceNote}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-slate-100 dark:bg-slate-800 mb-6" />

              {/* Features */}
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 font-medium"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.checkColor}`} />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${plan.ctaStyle}`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p
          className="text-center text-slate-400 text-sm mt-9 font-medium"
          style={{ fontFamily: "var(--font-body)" }}
        >
          All plans include a 14-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
}
