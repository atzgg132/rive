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
    ctaStyle: "border border-slate-200 text-slate-700 hover:bg-slate-50/50",
    highlighted: false,
    checkColor: "text-slate-400",
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
      "Priority support",
    ],
    cta: "join the waitlist",
    ctaStyle:
      "bg-gradient-to-r from-blue-600 to-sky-500 text-white hover:from-blue-700 hover:to-sky-600 shadow-lg shadow-blue-600/15",
    highlighted: true,
    checkColor: "text-blue-600",
  },
  {
    name: "Business",
    price: "$49",
    priceNote: "/month",
    description: "For agencies and growing businesses.",
    features: [
      "Everything in Pro",
      "Team collaboration (up to 10)",
      "Advanced analytics dashboard",
      "Client portal access",
      "Multi-currency (Remit early access)",
      "Custom integrations",
      "Dedicated account manager",
    ],
    cta: "join the waitlist",
    ctaStyle: "border border-blue-200 text-blue-600 hover:bg-blue-50/50",
    highlighted: false,
    checkColor: "text-sky-600",
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="relative bg-[#F5F8FC] py-28 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-100/10 rounded-full blur-[110px]" />
      </div>

      <div className="max-w-7xl mx-auto px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5">
            <span style={{ fontFamily: "var(--font-body)" }}>Simple, honest pricing</span>
          </div>
          <h2
            className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            plans for when{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              we launch.
            </span>
          </h2>
          <p
            className="text-slate-600 text-lg max-w-md mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            we&apos;re still building. join the waitlist to lock in early-adopter pricing when we go live.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl bg-white border border-slate-100 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/30 ${
                plan.highlighted
                  ? "border-blue-200 bg-gradient-to-b from-blue-50/20 to-white shadow-xl shadow-blue-100/40 pt-10 px-7 pb-7"
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
                  className="text-slate-800 font-bold text-lg mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-slate-400 text-sm mb-5 font-medium"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {plan.description}
                </p>
                <div className="flex items-end gap-0.5">
                  <span
                    className="text-5xl font-bold text-slate-800 leading-none"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {plan.price}
                  </span>
                  <span
                    className="text-slate-500 text-sm ml-1 mb-1 font-medium"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {plan.priceNote}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-slate-100 mb-6" />

              {/* Features */}
              <ul className="flex flex-col gap-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-slate-600 font-medium"
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
