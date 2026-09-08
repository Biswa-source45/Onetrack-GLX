import React, { useState } from "react"
import { motion } from "framer-motion"
import { Check, Zap, Shield, ArrowRight } from "lucide-react"
import { ledgerFont } from "../../lib/ledgerTheme"
import { SkiperSvgBeam } from "./SkiperSvgBeam"

export function PricingSection({ onSelectPlan }) {
  const [isAnnual, setIsAnnual] = useState(true)

  const PRICING_TIERS = [
    {
      id: "starter",
      name: "Starter Team",
      tagline: "Essential tender tracking for small executive teams",
      priceMonthly: "₹4,999",
      priceAnnual: "₹3,999",
      period: "/ month billed annually",
      featured: false,
      badge: "Free Trial Available",
      features: [
        "Up to 5 Active Users",
        "GeM & CPPP Tender Register",
        "Stage 1-5 Sequential Enforcement",
        "Standard EMD Deposit Tracking",
        "Email Notifications & Alerts",
        "Standard Export (Excel / CSV)",
      ],
      cta: "Start Free Trial",
    },
    {
      id: "pro",
      name: "Professional Ledger",
      tagline: "Complete workflow governance with automated Finance gates",
      priceMonthly: "₹14,999",
      priceAnnual: "₹11,999",
      period: "/ month billed annually",
      featured: true,
      badge: "Most Popular",
      features: [
        "Unlimited Users & Role Access",
        "All 11 Sequential Pipeline Gates",
        "Automated EMD & Bank Guarantee Tracking",
        "Multi-file Bulk Import Engine",
        "Role-Based Audit Trail & History",
        "Real-time Win/Loss Analytics",
        "Dedicated Account Manager",
        "24/7 Priority SLA Support",
      ],
      cta: "Get Started Now",
    },
    {
      id: "enterprise",
      name: "Enterprise Custom",
      tagline: "Dedicated infrastructure & bespoke system integrations",
      priceMonthly: "Custom",
      priceAnnual: "Custom",
      period: "Tailored contract",
      featured: false,
      badge: "Government & Enterprise",
      features: [
        "Custom On-Premise / Private Cloud",
        "API Integration with ERP & SAP",
        "Granular Role & Department Scoping",
        "Custom Stage Workflow Builder",
        "Immutable Database Audit Logs",
        "SOC2 & ISO 27001 Compliance",
        "Onsite Training & Setup",
      ],
      cta: "Contact Sales",
    },
  ]

  return (
    <section id="pricing" className="relative py-24 bg-slate-50 text-slate-900 overflow-hidden border-t border-slate-200">
      {/* Background soft blue radial gradient */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] bg-blue-500/10 blur-[120px] rounded-full" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <Zap className="size-3.5" /> Transparent Pricing for Public Bidding Teams
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: ledgerFont.display }}>
            Simple plans for total pipeline control
          </h2>

          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-medium">
            Choose the plan that matches your tender volume. All plans include full GeM & CPPP stage gating.
          </p>

          {/* Monthly / Annual Toggle Switch */}
          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-bold ${!isAnnual ? "text-blue-600" : "text-slate-500"}`}>Monthly Billing</span>

            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 rounded-full bg-slate-200 border border-slate-300 p-1 transition-colors focus:outline-none"
            >
              <motion.div
                className="w-6 h-6 rounded-full bg-blue-600 shadow-md"
                animate={{ x: isAnnual ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              />
            </button>

            <span className={`text-xs font-bold flex items-center gap-1.5 ${isAnnual ? "text-blue-600" : "text-slate-500"}`}>
              Annual Billing
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                SAVE 20%
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {PRICING_TIERS.map((tier) => (
            <motion.div
              key={tier.id}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.2 }}
              className={`relative flex flex-col rounded-2xl p-6 sm:p-8 bg-white transition-all shadow-md hover:shadow-xl ${
                tier.featured
                  ? "border-2 border-blue-600 shadow-blue-500/10"
                  : "border border-slate-200 hover:border-slate-300"
              }`}
            >
              {tier.featured && <SkiperSvgBeam glowColor="#2563eb" duration={5} />}

              {/* Badge Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: ledgerFont.display }}>
                  {tier.name}
                </h3>
                {tier.badge && (
                  <span
                    className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border ${
                      tier.featured
                        ? "bg-blue-100 text-blue-700 border-blue-300"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {tier.badge}
                  </span>
                )}
              </div>

              <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed min-h-[36px]">{tier.tagline}</p>

              {/* Price */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono">
                  {isAnnual ? tier.priceAnnual : tier.priceMonthly}
                </span>
                <span className="text-xs text-slate-500 font-medium">{tier.period}</span>
              </div>

              {/* Feature Checklist */}
              <ul className="mt-8 space-y-3 flex-1 text-xs text-slate-700 font-medium">
                {tier.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mt-0.5">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {/* Action CTA Button */}
              <div className="mt-8 pt-4">
                <button
                  onClick={() => onSelectPlan(tier)}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    tier.featured
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  <span>{tier.cta}</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Guarantee Banner */}
        <div className="mt-12 p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <Shield className="size-5 text-blue-600" />
            <span className="font-medium">All enterprise data stored in SOC2 compliant, ISO certified infrastructure in India.</span>
          </div>
          <span className="font-bold text-blue-600 hover:underline cursor-pointer">Read Compliance Documentation →</span>
        </div>
      </div>
    </section>
  )
}
