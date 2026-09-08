import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"
import { ledgerFont } from "../../lib/ledgerTheme"

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0)

  const FAQS = [
    {
      q: "How does OneTrack's sequential stage gating work?",
      a: "OneTrack enforces 11 mandatory sequential stages (from Discovery & Qualification to EMD Payment, Technical Bid, Commercial Approval, and Award). A tender cannot skip stages by accident; each transition requires server-verified authorization and role sign-off.",
    },
    {
      q: "How are EMD deposits and Bank Guarantees monitored?",
      a: "Our Finance module tracks deposit mode (Online, Demand Draft, Bank Guarantee), bank reference numbers, execution dates, and expiry windows. Automated notifications CC the bid executive and finance manager before deposit deadlines or return dates.",
    },
    {
      q: "What user roles are available in the platform?",
      a: "OneTrack supports 6 distinct roles: Super Admin, Admin, Manager (Lifecycle Owner), Bid Executive (Stage Execution), Pre-Sales (Eligibility & OEM), and Finance (EMD & Commercial Pricing). Each user only sees data and stage controls permitted for their role.",
    },
    {
      q: "Does OneTrack support bulk importing existing Excel workbooks?",
      a: "Yes! The system features a multi-file bulk import engine capable of ingesting GBX Tracker workbooks and Tender Dashboard Excel sheets. It handles duplicate detection, column normalization, and transaction boundaries automatically.",
    },
    {
      q: "Is data synchronized between GeM and CPPP portals?",
      a: "OneTrack standardizes tender metadata, portal IDs, and compliance rules across both GeM (Government e-Marketplace) and CPPP (Central Public Procurement Portal), keeping all multi-portal tenders in a single unified ledger.",
    },
    {
      q: "How can our team test the platform before committing?",
      a: "You can test all features using our interactive live demo board right here on the landing page, or click 'Sign In / Register' to request a 14-day full access demo workspace with sample bid data preloaded.",
    },
  ]

  return (
    <section id="faq" className="py-24 bg-white text-slate-900 border-t border-slate-200">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <HelpCircle className="size-3.5" /> Frequently Asked Questions
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" style={{ fontFamily: ledgerFont.display }}>
            Everything you need to know
          </h2>
          <p className="text-sm text-slate-600 font-medium max-w-lg mx-auto">
            Got questions about OneTrack's architecture, stage gating, or compliance? We've got answers.
          </p>
        </div>

        {/* Accordion List */}
        <div className="mt-12 space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-800 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <span className="pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`size-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-blue-600" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-200/60 bg-white">
                        <p className="pt-3">{faq.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
