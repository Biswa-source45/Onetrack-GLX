import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, ThumbsUp, ShieldCheck, Sparkles, AlertCircle } from "lucide-react"
import { ledgerFont } from "../../lib/ledgerTheme"
import { SkiperSvgBeam } from "./SkiperSvgBeam"

const DEMO_BOARDS = {
  pipeline: {
    title: "11-Stage Sequential Tender Pipeline Workspace",
    columns: [
      {
        id: "qual",
        title: "Stage 1-3 · Qualification & OEM Matrix",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        items: [
          {
            id: "t1",
            text: "GEM/2026/B/982110 · Smart City CCTV & Fiber Network",
            value: "₹4.80 Cr",
            owner: "Rohan V. (Pre-Sales)",
            stage: "Stage 3 · MAF Pending",
            category: "GeM Bid",
          },
          {
            id: "t2",
            text: "CPPP/2026/410299 · Data Center UPS & Precision Cooling",
            value: "₹1.25 Cr",
            owner: "Neha G. (Bid Exec)",
            stage: "Stage 2 · Tech Signoff",
            category: "CPPP Bid",
          },
        ],
      },
      {
        id: "emd",
        title: "Stage 4-6 · EMD & Financial Gate Lock",
        badgeColor: "bg-red-50 text-red-700 border-red-200",
        items: [
          {
            id: "t3",
            text: "GEM/2026/B/041872 · Highway Toll Automation Systems",
            value: "₹8.50 Cr",
            owner: "Suresh P. (Finance)",
            stage: "Stage 4 · BG Expiry Warning",
            category: "GeM Bid",
            alert: true,
          },
          {
            id: "t4",
            text: "CPPP/2026/991205 · Substation SCADA & RTU Automation",
            value: "₹3.60 Cr",
            owner: "Ananya D. (Finance)",
            stage: "Stage 5 · DD Verified",
            category: "CPPP Bid",
          },
        ],
      },
      {
        id: "award",
        title: "Stage 7-11 · Audit & Contract Award",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        items: [
          {
            id: "t5",
            text: "CPPP/2026/881204 · Railway Interlocking Signaling",
            value: "₹14.20 Cr",
            owner: "Biswa S. (Manager)",
            stage: "Stage 11 · L1 Handover",
            category: "CPPP Bid",
          },
        ],
      },
    ],
  },
  emdEngine: {
    title: "EMD Bank Guarantee & OEM Matrix Engine",
    columns: [
      {
        id: "oem",
        title: "OEM Authorization (MAF)",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        items: [
          { id: "o1", text: "Cisco Systems · MAF Certificate Cleared for Smart City Bid", votes: 14, author: "Pre-Sales", category: "OEM Cleared" },
          { id: "o2", text: "Schneider Electric · Technical Feasibility Compliance Verified", votes: 8, author: "Pre-Sales", category: "OEM Cleared" },
        ],
      },
      {
        id: "emdTrack",
        title: "EMD & BG Expiry Alerts",
        badgeColor: "bg-red-50 text-red-700 border-red-200",
        items: [
          { id: "o3", text: "NHAI Toll BG (₹17.0L) · Expiring in 18 Days", votes: 19, author: "Finance", category: "BG Expiry", alert: true },
          { id: "o4", text: "GeM Online EMD Refund (₹2.4L) · Refund Request Logged", votes: 11, author: "Finance", category: "EMD Refund" },
        ],
      },
      {
        id: "gateSignoff",
        title: "Role Matrix Signoffs",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        items: [
          { id: "o5", text: "Finance Margin Gate · Approved 14.5% margin for Railway bid", votes: 16, author: "Finance", category: "Approved" },
          { id: "o6", text: "Super Admin Audit Lock · Immutable stage history logged", votes: 12, author: "Super Admin", category: "Audit Pass" },
        ],
      },
    ],
  },
}

export function InteractiveBoardDemo() {
  const [activeTab, setActiveTab] = useState("pipeline")
  const [boardData, setBoardData] = useState(DEMO_BOARDS)
  const [newItemText, setNewItemText] = useState("")
  const [addingToCol, setAddingToCol] = useState(null)

  const currentBoard = boardData[activeTab]

  const handleVote = (colId, itemId) => {
    setBoardData((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        columns: prev[activeTab].columns.map((col) => {
          if (col.id !== colId) return col
          return {
            ...col,
            items: col.items.map((item) => {
              if (item.id !== itemId) return item
              return { ...item, votes: (item.votes || 0) + 1 }
            }),
          }
        }),
      },
    }))
  }

  const handleAddItem = (colId) => {
    if (!newItemText.trim()) return
    const newItem = {
      id: "user_" + Date.now(),
      text: newItemText.trim(),
      votes: 1,
      author: "You",
      category: activeTab === "pipeline" ? "New Tender" : "Live Item",
      value: activeTab === "pipeline" ? "₹2.50 Cr" : undefined,
      stage: activeTab === "pipeline" ? "Stage 1 · Entry" : undefined,
    }

    setBoardData((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        columns: prev[activeTab].columns.map((col) => {
          if (col.id !== colId) return col
          return { ...col, items: [newItem, ...col.items] }
        }),
      },
    }))

    setNewItemText("")
    setAddingToCol(null)
  }

  return (
    <div className="relative rounded-2xl p-1 overflow-hidden border border-blue-200 bg-white shadow-xl">
      <SkiperSvgBeam duration={6} glowColor="#2563eb" />

      {/* Board Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 sm:p-6 border-b border-blue-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 border border-blue-200 text-blue-600">
            <Sparkles className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-600">Interactive Workspace</span>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Interactive
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5" style={{ fontFamily: ledgerFont.display }}>
              {currentBoard.title}
            </h3>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 border border-slate-300">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "pipeline"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            11-Stage Tender Board
          </button>
          <button
            onClick={() => setActiveTab("emdEngine")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === "emdEngine"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            EMD & OEM Matrix Engine
          </button>
        </div>
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 sm:p-6 bg-slate-50/40">
        {currentBoard.columns.map((col) => (
          <div key={col.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 min-h-[320px] shadow-sm">
            {/* Column Title Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${col.badgeColor}`}>
                  {col.items.length}
                </span>
                <h4 className="text-xs font-bold text-slate-800">{col.title}</h4>
              </div>
              <button
                onClick={() => setAddingToCol(addingToCol === col.id ? null : col.id)}
                className="flex size-7 items-center justify-center rounded-lg bg-slate-100 hover:bg-blue-600 text-slate-600 hover:text-white transition-colors"
                title="Add new tender card"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Quick Add Form */}
            <AnimatePresence>
              {addingToCol === col.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3 overflow-hidden"
                >
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                    <input
                      type="text"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder="Type tender reference or task..."
                      className="w-full bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleAddItem(col.id)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setAddingToCol(null)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddItem(col.id)}
                        className="px-3 py-1 text-[11px] font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add Card
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cards List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {col.items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative rounded-xl border p-3.5 shadow-sm transition-all ${
                      item.alert
                        ? "border-red-300 bg-red-50/40 hover:border-red-400"
                        : "border-slate-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800 leading-relaxed">{item.text}</p>
                      {item.alert && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                          <AlertCircle className="size-3" /> Urgent
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        {item.category && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                            {item.category}
                          </span>
                        )}
                        {item.value && (
                          <span className="font-bold text-emerald-600 font-mono">{item.value}</span>
                        )}
                        {item.owner && <span>by {item.owner}</span>}
                        {item.stage && (
                          <span className={`font-bold ${item.alert ? "text-red-600" : "text-blue-600"}`}>
                            {item.stage}
                          </span>
                        )}
                      </div>

                      {activeTab === "emdEngine" && (
                        <button
                          onClick={() => handleVote(col.id, item.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 font-bold transition-colors cursor-pointer"
                        >
                          <ThumbsUp className="size-3" />
                          <span className="font-bold font-mono">{item.votes}</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info Ribbon */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 sm:px-6 bg-slate-50 border-t border-blue-100 text-xs text-slate-600">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 text-blue-600" />
          <span>OneTrack Live Stage Sync Active • Add tender cards or test stage progression</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
          <span>Zero Page Reload</span>
          <span>•</span>
          <span>Role Enforced</span>
          <span>•</span>
          <span>Audit Logged</span>
        </div>
      </div>
    </div>
  )
}
