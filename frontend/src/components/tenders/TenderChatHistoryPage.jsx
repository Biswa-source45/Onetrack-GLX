import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  CalendarClock,
  Calendar,
  Clock,
  History,
  Layers,
  Send,
  Paperclip,
  MessageSquare,
  MessagesSquare,
  CheckCircle2,
  AlertCircle,
  Filter,
  Sparkles,
  ChevronRight,
  ChevronDown,
  FileText,
  File,
  Pin,
  User,
  Users,
  Check,
  ArrowRight,
  ExternalLink,
  Loader2,
  RefreshCw,
  AtSign,
  HelpCircle,
  Megaphone,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { listBids, getBid, getBidStageHistory, STAGE_LABELS, WORKFLOW_STAGES_ORDERED, isStageAfterStage5 } from '../../services/bids'
import { getTenderChatMessages, sendTenderChatMessage, getTenderChatMembers } from '../../services/chat'
import { formatDateTime, formatDate, formatCurrency } from '../../lib/tenderFormat'
import { usePermissions } from '../../hooks/usePermissions'

const WORKFLOW_STAGES = [
  { key: 'DISCOVERED', short: 'S1 Search', full: '1. Search & ID' },
  { key: 'PRIMARY_REVIEW', short: 'S2 Review', full: '2. Primary Review' },
  { key: 'OEM_AUTHORIZATION_REQUEST', short: 'S3 OEM Auth', full: '3. OEM Auth' },
  { key: 'PRICING_REQUEST', short: 'S4 Pricing', full: '4. Pricing Request' },
  { key: 'DOCUMENT_CHECKLIST_PREPARATION', short: 'S5 Checklist', full: '5. Checklist Prep' },
  { key: 'EMD_PROCESSING', short: 'S6 EMD', full: '6. EMD Processing' },
  { key: 'INTERNAL_APPROVAL', short: 'S7 Approvals', full: '7. Internal Approval' },
  { key: 'GEM_SUBMISSION', short: 'S8 Submission', full: '8. Bid Submission' },
  { key: 'TECHNICAL_EVALUATION', short: 'S9 Tech Eval', full: '9. Tech Eval' },
  { key: 'FINANCIAL_EVALUATION', short: 'S10 Financial', full: '10. Financial Eval' },
]

export function TenderChatHistoryPage({ bid: propBid, bidId: propBidId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = usePermissions()

  const currentBidId = propBidId || propBid?.id || searchParams.get('tender') || ''
  const [bidsList, setBidsList] = useState([])
  const [selectedBid, setSelectedBid] = useState(propBid || null)
  const [loadingBids, setLoadingBids] = useState(false)

  // Real History Data States
  const [historyList, setHistoryList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Real Backend Chat Module States
  const [chatMessages, setChatMessages] = useState([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [sendingChat, setSendingChat] = useState(false)
  const [eligibleMembers, setEligibleMembers] = useState([])

  // Question & Mention States
  const [isQuestionMode, setIsQuestionMode] = useState(false)
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [activeConceptNumForMention, setActiveConceptNumForMention] = useState(1)

  // Active UI Concept Tab: 'concept-1' | 'concept-2' | 'concept-3' | 'concept-4'
  const [activeConcept, setActiveConcept] = useState('concept-1')

  // Dynamic Chat Window Visibility State
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false)

  // Concept 1 Filter State: 'all' | 'stage' | 'date' | 'doc'
  const [concept1Filter, setConcept1Filter] = useState('all')

  // Concept 2 Filter State: 'all' | 'discussion' | 'audit'
  const [concept2Filter, setConcept2Filter] = useState('all')

  // Concept 3 Drawer View: 'chat' | 'history'
  const [drawerTab, setDrawerTab] = useState('chat')

  // Inputs for different concept views
  const [inputMessage1, setInputMessage1] = useState('')
  const [inputMessage2, setInputMessage2] = useState('')
  const [inputMessage3, setInputMessage3] = useState('')

  // 1. Load available tenders list for selector (when in standalone sidebar mode)
  useEffect(() => {
    if (propBid) {
      setSelectedBid(propBid)
      return
    }
    async function fetchBids() {
      setLoadingBids(true)
      try {
        const res = await listBids({ limit: 50 })
        if (res.ok && Array.isArray(res.data)) {
          setBidsList(res.data)
          if (currentBidId) {
            const found = res.data.find((b) => b.id === currentBidId)
            if (found) setSelectedBid(found)
            else if (res.data.length > 0) setSelectedBid(res.data[0])
          } else if (res.data.length > 0) {
            setSelectedBid(res.data[0])
          }
        }
      } catch (err) {
        console.error('Failed to load tenders:', err)
      } finally {
        setLoadingBids(false)
      }
    }
    fetchBids()
  }, [propBid, currentBidId])

  // 2. Fetch the EXACT history data for the selected tender
  const loadExactHistory = async (targetBidId) => {
    if (!targetBidId) return
    setLoadingHistory(true)
    try {
      // Fetch full bid details (for closing_date_history, tech_eval, post_bid, stage_completions)
      const bidRes = await getBid(targetBidId)
      const fullBid = bidRes.ok && bidRes.data ? bidRes.data : selectedBid
      if (bidRes.ok && bidRes.data) {
        setSelectedBid(fullBid)
      }

      // Fetch real stage history records from backend
      const histRes = await getBidStageHistory(targetBidId, { limit: 100 })
      const backendData = histRes.ok && Array.isArray(histRes.data) ? histRes.data : []

      // Derive and parse event items
      const parsedBackend = backendData.map((b) => {
        let category = 'stage'
        const reasonLower = (b.transition_reason || '').toLowerCase()
        const toStage = (b.to_stage || '').toUpperCase()
        const eventType = (b.event_type || '').toUpperCase()

        if (
          eventType === 'END_DATE_CHANGED' ||
          toStage === 'END_DATE_CHANGED' ||
          toStage === 'DATE_CHANGED' ||
          eventType === 'TECH_EVAL_DATE_CHANGED' ||
          reasonLower.includes('end date') ||
          reasonLower.includes('closing date') ||
          reasonLower.includes('extension') ||
          reasonLower.includes('corrigendum') ||
          reasonLower.includes('date:')
        ) {
          category = 'date'
        } else if (
          toStage === 'GEM_SUBMISSION' ||
          reasonLower.includes('gem') ||
          reasonLower.includes('document') ||
          reasonLower.includes('receipt') ||
          reasonLower.includes('checklist') ||
          reasonLower.includes('submitted')
        ) {
          category = 'doc'
        }

        return {
          id: b.id,
          from_stage: b.from_stage,
          to_stage: b.to_stage,
          event_type: b.event_type || 'STAGE_CHANGE',
          category,
          transition_reason: b.transition_reason || 'Stage progression recorded',
          transitioned_by: b.transitioned_by || { full_name: 'Team Member', role: 'USER' },
          details: b.details,
          created_at: b.created_at || new Date().toISOString(),
        }
      })

      // Extract closing date revisions from fullBid.closing_date_history
      const closingDateEvents = (Array.isArray(fullBid?.closing_date_history) ? fullBid.closing_date_history : [])
        .filter((c) => {
          const cTime = new Date(c.changed_at || 0).getTime()
          return !parsedBackend.some((b) => {
            if (b.category !== 'date') return false
            const bTime = new Date(b.created_at || 0).getTime()
            return Math.abs(bTime - cTime) < 5000
          })
        })
        .map((c, idx) => {
          const oldStr = c.old_date ? formatDateTime(c.old_date) : 'N/A'
          const newStr = c.new_date ? formatDateTime(c.new_date) : 'N/A'
          const reason = c.reason
            ? `End date revised from ${oldStr} to ${newStr} (Corrigendum #${idx + 1}): ${c.reason}`
            : `End date extended from ${oldStr} to ${newStr} by ${c.changed_by_name || 'User'} (Change #${idx + 1})`
          return {
            id: `closing-date-${c.changed_at || idx}`,
            from_stage: fullBid?.workflow_stage,
            to_stage: 'END_DATE_CHANGED',
            event_type: 'END_DATE_CHANGED',
            category: 'date',
            transition_reason: reason,
            transitioned_by: {
              full_name: c.changed_by_name || 'Pre-Sales / Management',
              role: 'Corrigendum Admin',
            },
            details: {
              old_date: oldStr,
              new_date: newStr,
              change_count: idx + 1,
              reason: c.reason,
            },
            created_at: c.changed_at || new Date().toISOString(),
          }
        })

      // Extract GeM submission event if present
      const pb = fullBid?.post_bid
      const postBidEvents =
        pb?.submittedAt &&
          !parsedBackend.some((b) => (b.transition_reason || '').toLowerCase().includes('submitted on gem'))
          ? [
            {
              id: `gem-sub-${fullBid.id}`,
              from_stage: 'INTERNAL_APPROVAL',
              to_stage: 'GEM_SUBMISSION',
              event_type: 'STAGE_CHANGE',
              category: 'doc',
              transition_reason: `Tender Final Submission Recorded on GeM Portal by ${pb.submittedBy || 'Bid Executive'}${pb.submittedPrice ? ' at ₹ ' + Number(pb.submittedPrice).toLocaleString('en-IN') : ''
                }`,
              transitioned_by: {
                full_name: pb.submittedBy || 'Bid Executive',
                role: 'Bid Exec',
              },
              created_at: pb.submittedAt,
            },
          ]
          : []

      // Tender Creation / Discovery Event
      const creationEvent = fullBid?.created_at
        ? [
          {
            id: `creation-${fullBid.id}`,
            from_stage: null,
            to_stage: 'DISCOVERED',
            event_type: 'TENDER_CREATED',
            category: 'stage',
            transition_reason: `Tender discovered and initialized on OneTrack${fullBid.estimated_value ? ` with initial estimated value ₹ ${Number(fullBid.estimated_value).toLocaleString('en-IN')}` : ''
              }`,
            transitioned_by: {
              full_name: fullBid.created_by_name || fullBid.owner_name || 'System / Admin',
              role: 'Creator',
            },
            created_at: fullBid.created_at,
          },
        ]
        : []

      // Combine, deduplicate, and sort chronologically (newest first)
      const combined = [...parsedBackend, ...closingDateEvents, ...postBidEvents, ...creationEvent].sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
      )

      setHistoryList(combined)
    } catch (err) {
      console.error('Failed to load tender history:', err)
      toast.error('Could not load complete history for this tender')
    } finally {
      setLoadingHistory(false)
    }
  }

  // 3. Load Real Backend Chat Messages & Mention Members
  const loadChatFromBackend = async (targetBidId) => {
    if (!targetBidId) return
    try {
      const [chatRes, membersRes] = await Promise.all([
        getTenderChatMessages(targetBidId),
        getTenderChatMembers(targetBidId),
      ])
      if (chatRes.ok && Array.isArray(chatRes.data)) {
        setChatMessages(chatRes.data)
      }
      if (membersRes.ok && Array.isArray(membersRes.data)) {
        setEligibleMembers(membersRes.data)
      }
    } catch (err) {
      console.error('Failed to load chat from backend:', err)
    }
  }

  useEffect(() => {
    if (!selectedBid?.id) return
    loadExactHistory(selectedBid.id)
    setLoadingChat(true)
    loadChatFromBackend(selectedBid.id).finally(() => setLoadingChat(false))

    // Background live sync interval every 4 seconds to pull teammate updates
    const interval = setInterval(() => {
      loadChatFromBackend(selectedBid.id)
    }, 4000)

    return () => clearInterval(interval)
  }, [selectedBid?.id])

  const handleSelectTender = (e) => {
    const id = e.target.value
    const found = bidsList.find((b) => b.id === id)
    if (found) {
      setSelectedBid(found)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('tender', id)
      setSearchParams(nextParams)
    }
  }

  // Handle typing input with @ mention trigger
  const handleInputChange = (conceptNum, value) => {
    if (conceptNum === 1) setInputMessage1(value)
    else if (conceptNum === 2) setInputMessage2(value)
    else if (conceptNum === 3) setInputMessage3(value)

    setActiveConceptNumForMention(conceptNum)

    // Check if the user is typing an @ mention
    const lastWord = value.split(/\s+/).pop() || ''
    if (lastWord.startsWith('@')) {
      setMentionFilter(lastWord.slice(1))
      setShowMentionMenu(true)
    } else {
      setShowMentionMenu(false)
    }
  }

  // Insert mention into input
  const insertMention = (conceptNum, member) => {
    const isGroup = member.id === 'everyone' || member.id === 'all'
    const mentionToken = isGroup ? `@${member.id} ` : `@${member.full_name} `

    const updateText = (prev) => {
      const atIdx = prev.lastIndexOf('@')
      if (atIdx >= 0) {
        return prev.slice(0, atIdx) + mentionToken
      }
      return prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + mentionToken
    }

    if (conceptNum === 1) setInputMessage1(updateText)
    else if (conceptNum === 2) setInputMessage2(updateText)
    else if (conceptNum === 3) setInputMessage3(updateText)

    setShowMentionMenu(false)
  }

  // Handle posting message via real Backend Chat API
  const handlePostMessage = async (conceptNumber) => {
    let msgText = ''
    if (conceptNumber === 1) {
      msgText = inputMessage1.trim()
    } else if (conceptNumber === 2) {
      msgText = inputMessage2.trim()
    } else if (conceptNumber === 3) {
      msgText = inputMessage3.trim()
    }

    if (!msgText || !selectedBid?.id) return

    setSendingChat(true)
    try {
      // Extract mentions
      const mentions = []
      eligibleMembers.forEach((m) => {
        if (m.username && msgText.toLowerCase().includes(`@${m.username.toLowerCase()}`)) {
          mentions.push(m.username)
        } else if (m.full_name && msgText.toLowerCase().includes(`@${m.full_name.toLowerCase()}`)) {
          mentions.push(m.full_name)
        }
      })
      if (msgText.toLowerCase().includes('@everyone') || msgText.toLowerCase().includes('@team')) {
        if (!mentions.includes('everyone')) mentions.push('everyone')
      }

      const payload = {
        content: msgText,
        message_type: isQuestionMode ? 'QUESTION' : msgText.endsWith('?') ? 'QUESTION' : 'CHAT',
        mentions,
        attachments: [],
      }

      const res = await sendTenderChatMessage(selectedBid.id, payload)
      if (res.ok && res.data) {
        setChatMessages((prev) => [...prev, res.data])
        toast.success(isQuestionMode ? 'Tender question posted to team' : 'Message posted to tender discussion')
        if (conceptNumber === 1) setInputMessage1('')
        if (conceptNumber === 2) setInputMessage2('')
        if (conceptNumber === 3) setInputMessage3('')
        setIsQuestionMode(false)
        setShowMentionMenu(false)
      } else {
        toast.error(res.message || 'Failed to post message')
      }
    } catch (err) {
      toast.error('Network error posting message')
    } finally {
      setSendingChat(false)
    }
  }

  // Filter eligible members for mention menu
  const filteredEligibleMembers = useMemo(() => {
    if (!mentionFilter) return eligibleMembers
    const q = mentionFilter.toLowerCase()
    return eligibleMembers.filter(
      (m) =>
        (m.full_name && m.full_name.toLowerCase().includes(q)) ||
        (m.username && m.username.toLowerCase().includes(q))
    )
  }, [eligibleMembers, mentionFilter])

  // Helper to render role badge class
  const getRoleBadgeClass = (role) => {
    const r = (role || '').toUpperCase()
    if (r.includes('SUPER_ADMIN') || r.includes('SADMIN')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
    }
    if (r.includes('OWNER') || r.includes('MANAGER')) {
      return 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
    }
    if (r.includes('BID_EXECUTIVE') || r.includes('EXEC')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
    }
    if (r.includes('FINANCE')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  }

  // Helper to render mentions nicely inside message text
  const renderMessageContent = (content) => {
    if (!content) return null
    const tokens = content.split(/(@[\w\s.-]+)/g)
    return tokens.map((part, idx) => {
      if (part.startsWith('@')) {
        const isEveryone =
          part.toLowerCase().includes('everyone') ||
          part.toLowerCase().includes('team') ||
          part.toLowerCase().includes('all')
        return (
          <span
            key={idx}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-bold text-[11px] mx-0.5 border ${isEveryone
              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700'
              : 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700'
              }`}
          >
            {isEveryone ? <Users className="size-3 text-amber-600 shrink-0" /> : <AtSign className="size-3 text-indigo-600 shrink-0" />}
            <span>{part}</span>
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }

  // Tender Display Info
  const tenderDisplayTitle = selectedBid?.title || 'Tender Workspace'
  const tenderBidNo = selectedBid?.bid_number || selectedBid?.bid_no || 'GLX-95920'
  const tenderStage = selectedBid?.current_stage || selectedBid?.workflow_stage || 'DISCOVERED'
  const tenderStageLabel = STAGE_LABELS[tenderStage] || tenderStage
  const isPostStage5 = isStageAfterStage5(tenderStage)

  // Concept 1 Filtered Events
  const filteredConcept1History = useMemo(() => {
    if (concept1Filter === 'all') return historyList
    return historyList.filter((e) => e.category === concept1Filter)
  }, [historyList, concept1Filter])

  // Counts for Concept 1 filter chips
  const countAll = historyList.length
  const countStage = historyList.filter((e) => e.category === 'stage').length
  const countDate = historyList.filter((e) => e.category === 'date').length
  const countDoc = historyList.filter((e) => e.category === 'doc').length

  // Concept 2 Stream Items (blended chronological history + chat)
  const blendedStream = useMemo(() => {
    const histItems = historyList.map((h) => ({
      type: 'audit',
      id: h.id,
      date: new Date(h.created_at || 0),
      raw: h,
    }))
    const chatItems = chatMessages.map((c) => ({
      type: 'discussion',
      id: c.id,
      date: new Date(c.created_at || c.createdAt || Date.now()),
      raw: c,
    }))

    let combined = []
    if (concept2Filter === 'all') combined = [...histItems, ...chatItems]
    else if (concept2Filter === 'discussion') combined = [...chatItems]
    else if (concept2Filter === 'audit') combined = [...histItems]

    return combined.sort((a, b) => b.date - a.date)
  }, [historyList, chatMessages, concept2Filter])

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
              Live Backend Connected
            </span>
            <span className="text-xs text-muted-foreground">PostgreSQL Chat Module</span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {eligibleMembers.length} Members Available for Mentions
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2 flex-wrap">
            <span>Tender History & Team Chat</span>
            <span className="text-muted-foreground font-normal text-base">| {tenderBidNo}</span>
          </h1>

          <p className="text-xs md:text-sm text-muted-foreground">
            Explore 4 production UI designs connected to the dedicated backend chat module with @mentions and immutable audit history.
          </p>

          {/* Tender Selector (when opened from standalone sidebar) */}
          {!propBid && bidsList.length > 0 && (
            <div className="pt-2 flex items-center gap-2.5 flex-wrap">
              <label htmlFor="tender-select" className="text-xs font-semibold text-foreground">
                Select Tender:
              </label>
              <select
                id="tender-select"
                value={selectedBid?.id || ''}
                onChange={handleSelectTender}
                className="text-xs bg-background border border-border rounded-lg px-2.5 py-1 text-foreground focus:outline-hidden focus:ring-2 focus:ring-teal-500 max-w-xs truncate cursor-pointer"
              >
                {bidsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bid_number || b.bid_no || 'Tender'} - {b.title?.slice(0, 36)}...
                  </option>
                ))}
              </select>

              {selectedBid?.id && (
                <Link
                  to={`/dashboard/tenders/${selectedBid.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
                  title={`Go to ${selectedBid.bid_number || selectedBid.bid_no || 'Tender'}`}
                >
                  <span>Go To Tender</span>
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Concept Switcher Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-xl border border-border shrink-0 self-start md:self-center">
          <button
            onClick={() => setActiveConcept('concept-1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeConcept === 'concept-1'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
          >
            1. Split Hub
          </button>
          <button
            onClick={() => setActiveConcept('concept-2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeConcept === 'concept-2'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
          >
            2. Omnichannel Stream
          </button>
          <button
            onClick={() => setActiveConcept('concept-3')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeConcept === 'concept-3'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
          >
            3. Slide-Over Drawer
          </button>
          <button
            onClick={() => setActiveConcept('concept-4')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeConcept === 'concept-4'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
          >
            4. Stepper & Mini-Dock
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONCEPT 1: Split-Screen Unified Hub (Side-by-Side)                        */}
      {/* ========================================================================= */}
      {activeConcept === 'concept-1' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal-500 animate-pulse"></span>
              <span className="font-semibold text-foreground">Concept 1 (Split Hub):</span>
              <span>
                Left pane tracks live audit history; Right pane is connected to the backend Chat Module with @mentions and team inquiries.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {chatMessages.length} Messages in DB
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
            {/* Left Column: Audit Timeline (expands to 12 cols when chat is closed, 7 cols when open) */}
            <div className={`transition-all duration-300 ${isChatWindowOpen ? 'lg:col-span-7' : 'lg:col-span-12'} bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm`}>
              {/* Timeline Header & Filters */}
              <div className="p-4 border-b border-border bg-muted/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950 dark:border-teal-800">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Tender Lifecycle & Audit History</h3>
                      <p className="text-[11px] text-muted-foreground">
                        Chronological record of stage progression, date changes, and GeM submission receipts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-muted text-foreground border border-border">
                      {countAll} Events
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setIsChatWindowOpen((prev) => !prev)}
                      className={`h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs transition-all ${isChatWindowOpen
                        ? 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                        }`}
                    >
                      <MessagesSquare className="size-3.5" />
                      <span>{isChatWindowOpen ? 'Hide Chat Window' : 'Open Chat Window'}</span>
                      {chatMessages.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isChatWindowOpen ? 'bg-background text-foreground' : 'bg-white/25 text-white'
                          }`}>
                          {chatMessages.length}
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    onClick={() => setConcept1Filter('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${concept1Filter === 'all'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    All Events ({countAll})
                  </button>
                  <button
                    onClick={() => setConcept1Filter('stage')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${concept1Filter === 'stage'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Stage Progress ({countStage})
                  </button>
                  <button
                    onClick={() => setConcept1Filter('date')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${concept1Filter === 'date'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Date Extensions ({countDate})
                  </button>
                  <button
                    onClick={() => setConcept1Filter('doc')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${concept1Filter === 'doc'
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    Document Logs ({countDoc})
                  </button>
                </div>
              </div>

              {/* Timeline Items List */}
              <div className="p-4 overflow-y-auto space-y-4 max-h-[520px] flex-1 bg-card">
                {loadingHistory ? (
                  <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Loader2 className="size-6 animate-spin text-teal-600" />
                    <span className="text-xs">Loading tender audit records…</span>
                  </div>
                ) : filteredConcept1History.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground space-y-1">
                    <History className="size-6 mx-auto text-muted-foreground/60" />
                    <p className="text-xs font-semibold">No audit events match this filter</p>
                    <p className="text-[11px]">Select another filter or reset to "All Events".</p>
                  </div>
                ) : (
                  filteredConcept1History.map((e, index) => {
                    const isLast = index === filteredConcept1History.length - 1
                    const isDate = e.category === 'date'
                    const isDoc = e.category === 'doc'
                    const stageKey = e.to_stage || e.from_stage || ''
                    const stageBadge = STAGE_LABELS[stageKey] || stageKey

                    let circleBg = 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                    let EventIcon = Layers

                    if (isDate) {
                      circleBg = 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      EventIcon = CalendarClock
                    } else if (isDoc) {
                      circleBg = 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                      EventIcon = Check
                    } else if (stageKey === 'DISCOVERED' || e.event_type === 'TENDER_CREATED') {
                      circleBg = 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                      EventIcon = Sparkles
                    } else if (stageKey === 'INTERNAL_APPROVAL') {
                      circleBg = 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                      EventIcon = CheckCircle2
                    }

                    return (
                      <div
                        key={e.id}
                        className={`flex gap-3 relative ${!isLast ? 'before:absolute before:left-[17px] before:top-8 before:bottom-0 before:w-0.5 before:bg-border' : ''
                          }`}
                      >
                        <div className={`size-9 rounded-full border flex items-center justify-center shrink-0 z-10 text-xs font-bold ${circleBg}`}>
                          <EventIcon className="size-4" />
                        </div>
                        <div className="flex-1 bg-card border border-border rounded-xl p-3.5 space-y-2 hover:border-teal-300 transition-colors shadow-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">
                                {isDate
                                  ? 'Tender End Date / Milestone Revised'
                                  : stageKey
                                    ? `Stage: ${stageBadge}`
                                    : 'Tender Activity'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${isDate
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : isDoc
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                                  }`}
                              >
                                {isDate ? 'Date Event' : isDoc ? 'Submission & Doc' : 'Stage Transition'}
                              </span>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{formatDateTime(e.created_at)}</span>
                          </div>

                          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                            {e.transition_reason}
                          </p>

                          {/* Diff Details if Date Changed */}
                          {e.details?.old_date && e.details?.new_date && (
                            <div className="flex items-center gap-2 text-xs flex-wrap bg-muted/40 p-2 rounded-lg border border-border">
                              <span className="line-through text-muted-foreground">{e.details.old_date}</span>
                              <span className="text-teal-600 font-bold">→</span>
                              <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                                {e.details.new_date}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                            <span>
                              Recorded by: <strong className="text-foreground">{e.transitioned_by?.full_name || e.transitioned_by?.username || 'Team Member'}</strong>
                            </span>
                            {e.from_stage && e.to_stage && (
                              <span className="text-[10px] text-muted-foreground">
                                {STAGE_LABELS[e.from_stage] || e.from_stage} → {STAGE_LABELS[e.to_stage] || e.to_stage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Column: Dynamic Live Backend Chat Window (Opened on Demand) */}
            {isChatWindowOpen && (
              <div className="lg:col-span-5 bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm relative animate-in fade-in slide-in-from-right-4 duration-200">
                {/* Chat Header */}
                <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950 dark:border-teal-800">
                      <MessagesSquare className="size-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Tender Discussion Room</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Channel: {tenderBidNo} · Live Database Sync</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => loadChatFromBackend(selectedBid?.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Refresh Chat from Backend"
                    >
                      <RefreshCw className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setIsChatWindowOpen(false)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                      title="Close Chat Window"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Chat Messages Body */}
                <div className="p-4 overflow-y-auto space-y-3.5 max-h-[440px] flex-1 bg-card">
                  {loadingChat && chatMessages.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Loader2 className="size-6 animate-spin text-teal-600" />
                      <span className="text-xs">Connecting to Chat Module…</span>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground space-y-1">
                      <MessageSquare className="size-6 mx-auto text-muted-foreground/60" />
                      <p className="text-xs font-semibold">No messages in room yet</p>
                      <p className="text-[11px]">Type below to start team discussion or ask questions with @mentions.</p>
                    </div>
                  ) : (
                    chatMessages.map((msg) => {
                      const senderName = msg.sender_name || msg.sender || 'Team Member'
                      const senderRole = msg.sender_role || msg.role || 'Member'
                      const timeStr = msg.created_at ? formatDateTime(msg.created_at) : msg.time || 'Recently'
                      const isQuestion = msg.message_type === 'QUESTION'
                      const isAnnouncement = msg.message_type === 'ANNOUNCEMENT'

                      return (
                        <div key={msg.id} className="flex gap-2.5">
                          <div
                            className={`size-7 rounded-full border text-xs font-bold flex items-center justify-center shrink-0 ${isAnnouncement
                              ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                              : isQuestion
                                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-primary/10 border-primary/20 text-primary'
                              }`}
                          >
                            {isAnnouncement ? <Sparkles className="size-3.5" /> : senderName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">{senderName}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getRoleBadgeClass(senderRole)}`}>
                                {senderRole}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                            </div>

                            {/* Message bubble */}
                            <div
                              className={`rounded-xl rounded-tl-none p-3 text-xs border leading-relaxed ${isAnnouncement
                                ? 'bg-blue-50/80 border-blue-200 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100'
                                : isQuestion
                                  ? 'bg-amber-50/80 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100'
                                  : 'bg-muted/60 border-border text-foreground'
                                }`}
                            >
                              {/* Message Type Banner */}
                              {isQuestion && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 w-fit mb-1.5">
                                  <HelpCircle className="size-3 text-amber-600 dark:text-amber-400" />
                                  <span>Question About Tender</span>
                                </div>
                              )}

                              {isAnnouncement && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-200 w-fit mb-1.5">
                                  <Sparkles className="size-3 text-blue-600 dark:text-blue-400" />
                                  <span>Official Tender Initiation</span>
                                </div>
                              )}

                              <div>{renderMessageContent(msg.content || msg.text)}</div>

                              {/* Attachments if any */}
                              {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {msg.attachments.map((att, aIdx) => (
                                    <div key={aIdx} className="flex items-center gap-2 p-1.5 rounded bg-background border border-border text-[11px]">
                                      <FileText className="size-3.5 text-rose-500" />
                                      <span className="font-medium text-foreground">{att.name}</span>
                                      {att.size && <span className="text-muted-foreground text-[10px]">{att.size}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Mention Selector Dropdown (Floating above Input) */}
                {showMentionMenu && (
                  <div className="absolute bottom-16 left-4 right-4 bg-popover border border-border rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-2 py-1 text-xs border-b border-border">
                      <span className="font-bold flex items-center gap-1 text-foreground">
                        <AtSign className="size-3.5 text-teal-600" /> Mention Colleague or Team
                      </span>
                      <button
                        onClick={() => setShowMentionMenu(false)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {filteredEligibleMembers.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No matching colleagues found</div>
                      ) : (
                        filteredEligibleMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => insertMention(activeConceptNumForMention, member)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${member.id === 'everyone' || member.id === 'all'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-primary/10 text-primary'
                                  }`}
                              >
                                {member.id === 'everyone' || member.id === 'all' ? <Users className="size-3" /> : (member.full_name || member.username)[0].toUpperCase()}
                              </div>
                              <div className="truncate">
                                <span className="font-semibold text-foreground block truncate">
                                  {member.full_name}
                                </span>
                                {member.username && member.id !== 'everyone' && member.id !== 'all' && (
                                  <span className="text-[10px] text-muted-foreground">@{member.username}</span>
                                )}
                              </div>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${getRoleBadgeClass(member.role)}`}>
                              {member.role || 'USER'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Chat Input Footer (Connected to Backend Chat Module) */}
                <div className="p-3 border-t border-border bg-muted/40 space-y-2">
                  {isQuestionMode && (
                    <div className="flex items-center justify-between px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800">
                      <span className="flex items-center gap-1 font-semibold">
                        <HelpCircle className="size-3.5 text-amber-600" />
                        Inquiry Mode: Asking a question about this tender
                      </span>
                      <button
                        onClick={() => setIsQuestionMode(false)}
                        className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={inputMessage1}
                      onChange={(e) => handleInputChange(1, e.target.value)}
                      placeholder={
                        isQuestionMode
                          ? `Ask a question about ${tenderBidNo} (e.g. Can @everyone confirm specs?)...`
                          : `Comment on ${tenderBidNo} or type @ to mention colleagues...`
                      }
                      className={`flex-1 bg-background text-xs h-9 ${isQuestionMode ? 'border-amber-400 focus:ring-amber-400' : ''
                        }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handlePostMessage(1)
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={sendingChat || !inputMessage1.trim()}
                      onClick={() => handlePostMessage(1)}
                      className="h-9 px-3.5 bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs font-semibold shadow-xs shrink-0"
                    >
                      {sendingChat ? <Loader2 className="size-3.5 animate-spin" /> : <span>Send</span>}
                      <Send className="size-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveConceptNumForMention(1)
                          setMentionFilter('')
                          setShowMentionMenu((prev) => !prev)
                        }}
                        className="hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                      >
                        <AtSign className="size-3.5 text-indigo-600" />
                        <span>@ Mention</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsQuestionMode((prev) => !prev)}
                        className={`flex items-center gap-1 font-medium transition-colors ${isQuestionMode ? 'text-amber-600 font-bold' : 'hover:text-foreground'
                          }`}
                      >
                        <HelpCircle className="size-3.5 text-amber-600" />
                        <span>{isQuestionMode ? 'Question (On)' : 'Ask Question'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => insertMention(1, { id: 'all', full_name: 'all' })}
                        className="hover:text-foreground flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border"
                        title={isPostStage5 ? "Mention all team members (includes MD in Stage 6+)" : "Mention all team members (excludes MD in Stages 1-5)"}
                      >
                        <Users className="size-3 text-amber-600" />
                        <span>@all</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${isPostStage5 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                          {isPostStage5 ? '+MD' : 'excl. MD'}
                        </span>
                      </button>
                    </div>
                    <span className="hidden sm:inline-block">Press Enter to send</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 2: Unified Omnichannel Stream (Blended History & Chat)            */}
      {/* ========================================================================= */}
      {activeConcept === 'concept-2' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-sky-500 animate-pulse"></span>
              <span className="font-semibold text-foreground">Exact Omnichannel Timeline:</span>
              <span>
                Real system audit milestones and team discussion comments for <strong className="text-foreground">{tenderBidNo}</strong> blended in one linear stream.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              {blendedStream.length} Total Updates
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm max-w-4xl mx-auto relative">
            {/* Header & Tabs */}
            <div className="p-4 border-b border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-foreground">Tender Activity & Discussion Feed</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground border border-border font-medium">
                  {blendedStream.length} updates
                </span>
                {selectedBid?.id && (
                  <Link
                    to={`/dashboard/tenders/${selectedBid.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer ml-1"
                    title={`Go to ${selectedBid.bid_number || selectedBid.bid_no || 'Tender'}`}
                  >
                    <span>Go To Tender</span>
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border text-xs">
                <button
                  onClick={() => setConcept2Filter('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${concept2Filter === 'all'
                    ? 'font-semibold bg-sky-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  All Stream ({historyList.length + chatMessages.length})
                </button>
                <button
                  onClick={() => setConcept2Filter('discussion')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${concept2Filter === 'discussion'
                    ? 'font-semibold bg-sky-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Discussions ({chatMessages.length})
                </button>
                <button
                  onClick={() => setConcept2Filter('audit')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${concept2Filter === 'audit'
                    ? 'font-semibold bg-sky-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Audit History ({historyList.length})
                </button>
              </div>
            </div>

            {/* Single Stream Body */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[500px] bg-card">
              {loadingHistory && blendedStream.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="size-6 animate-spin text-sky-600" />
                  <span className="text-xs">Loading exact chronological events…</span>
                </div>
              ) : blendedStream.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-1">
                  <Clock className="size-6 mx-auto text-muted-foreground/60" />
                  <p className="text-xs font-semibold">No activity recorded yet for this filter</p>
                </div>
              ) : (
                blendedStream.map((item) => {
                  if (item.type === 'audit') {
                    const e = item.raw
                    const isDate = e.category === 'date'
                    return (
                      <div
                        key={e.id}
                        className={`rounded-xl p-3 flex items-center justify-between text-xs border ${isDate
                          ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800'
                          : 'bg-teal-50/70 border-teal-200 dark:bg-teal-950/40 dark:border-teal-800'
                          }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-3">
                          <span
                            className={`size-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${isDate
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                              : 'bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300'
                              }`}
                          >
                            {isDate ? <CalendarClock className="size-3.5" /> : 'LOG'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-foreground truncate">
                              {isDate ? 'Milestone / End Date Revised' : STAGE_LABELS[e.to_stage] || e.to_stage || 'Audit Milestone'}
                            </p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {e.transition_reason} · <span className="font-medium text-foreground">{e.transitioned_by?.full_name}</span>
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(e.created_at)}</span>
                      </div>
                    )
                  }

                  // Discussion Card from Real Backend
                  const msg = item.raw
                  const senderName = msg.sender_name || msg.sender || 'Team Member'
                  const senderRole = msg.sender_role || msg.role || 'Member'
                  const timeStr = msg.created_at ? formatDateTime(msg.created_at) : msg.time || 'Recently'
                  const isQuestion = msg.message_type === 'QUESTION'
                  const isAnnouncement = msg.message_type === 'ANNOUNCEMENT'

                  return (
                    <div key={msg.id} className="bg-card border border-border rounded-xl p-4 space-y-2.5 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`size-8 rounded-full border text-xs font-bold flex items-center justify-center ${isAnnouncement ? 'bg-blue-100 text-blue-800' : isQuestion ? 'bg-amber-100 text-amber-800' : 'bg-primary/10 text-primary'
                            }`}>
                            {isAnnouncement ? <Sparkles className="size-4" /> : senderName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">{senderName}</span>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getRoleBadgeClass(senderRole)}`}>
                                {senderRole}
                              </span>
                              {isQuestion && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                                  Question
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                          </div>
                        </div>
                        <span
                          onClick={() => {
                            setInputMessage2((prev) => prev + `@${senderName} `)
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        >
                          Reply
                        </span>
                      </div>
                      <div className="text-xs text-foreground leading-relaxed">
                        {renderMessageContent(msg.content || msg.text)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Mention Dropdown for Concept 2 */}
            {showMentionMenu && activeConceptNumForMention === 2 && (
              <div className="absolute bottom-16 left-4 right-4 bg-popover border border-border rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-2 py-1 text-xs border-b border-border">
                  <span className="font-bold flex items-center gap-1 text-foreground">
                    <AtSign className="size-3.5 text-sky-600" /> Mention Colleague or Team
                  </span>
                  <button onClick={() => setShowMentionMenu(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {filteredEligibleMembers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No matching colleagues found</div>
                  ) : (
                    filteredEligibleMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => insertMention(2, member)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${member.id === 'everyone' || member.id === 'all'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-primary/10 text-primary'
                              }`}
                          >
                            {member.id === 'everyone' || member.id === 'all' ? <Users className="size-3" /> : (member.full_name || member.username)[0].toUpperCase()}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-foreground block truncate">
                              {member.full_name}
                            </span>
                            {member.username && member.id !== 'everyone' && member.id !== 'all' && (
                              <span className="text-[10px] text-muted-foreground">@{member.username}</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${getRoleBadgeClass(member.role)}`}>
                          {member.role || 'USER'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Sticky Bottom Composer */}
            <div className="p-3.5 border-t border-border bg-muted/40 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={inputMessage2}
                  onChange={(e) => handleInputChange(2, e.target.value)}
                  placeholder={`Share an update or ask a question with @mentions...`}
                  className="flex-1 bg-background text-xs h-9"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handlePostMessage(2)
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={sendingChat || !inputMessage2.trim()}
                  onClick={() => handlePostMessage(2)}
                  className="h-9 px-4 bg-sky-600 hover:bg-sky-700 text-white gap-1.5 text-xs font-semibold shadow-xs"
                >
                  {sendingChat ? <Loader2 className="size-3.5 animate-spin" /> : <span>Post Update</span>}
                  <Send className="size-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveConceptNumForMention(2)
                    setMentionFilter('')
                    setShowMentionMenu((prev) => !prev)
                  }}
                  className="hover:text-foreground flex items-center gap-1 font-medium"
                >
                  <AtSign className="size-3 text-sky-600" />
                  <span>@ Mention</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuestionMode((prev) => !prev)}
                  className={`flex items-center gap-1 font-medium ${isQuestionMode ? 'text-amber-600 font-bold' : 'hover:text-foreground'}`}
                >
                  <HelpCircle className="size-3 text-amber-600" />
                  <span>{isQuestionMode ? 'Question (Active)' : 'Ask Question'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => insertMention(2, { id: 'all', full_name: 'all' })}
                  className="hover:text-foreground flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border"
                  title={isPostStage5 ? "Mention all team members (includes MD in Stage 6+)" : "Mention all team members (excludes MD in Stages 1-5)"}
                >
                  <Users className="size-3 text-sky-600" />
                  <span>@all</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-medium ${isPostStage5 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                    {isPostStage5 ? '+MD' : 'excl. MD'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 3: Contextual Slide-Over Drawer                                   */}
      {/* ========================================================================= */}
      {activeConcept === 'concept-3' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-violet-500 animate-pulse"></span>
              <span className="font-semibold text-foreground">Exact Tender Context & Slide-Over Drawer:</span>
              <span>
                Active stage workspace for <strong className="text-foreground">{tenderBidNo}</strong> with real lifecycle dates in background, and slide-over audit/chat on the right.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Context Retained
            </span>
          </div>

          <div className="relative bg-muted/30 border border-border rounded-2xl overflow-hidden min-h-[580px] shadow-md flex flex-col md:flex-row">
            {/* Background Stage Workspace (Actual Real Data) */}
            <div className="flex-1 p-6 space-y-6 opacity-75 pointer-events-none">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Current Stage: {tenderStageLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {tenderDisplayTitle} · Bid Number: {tenderBidNo}
                  </p>
                </div>
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300">
                  {selectedBid?.bid_status || 'ACTIVE'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
                  <span className="text-xs text-muted-foreground">Tech Eval Milestone</span>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {selectedBid?.tech_eval?.dates?.evaluation ? formatDate(selectedBid.tech_eval.dates.evaluation) : 'Not Scheduled'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
                  <span className="text-xs text-muted-foreground">Tender Closing Date</span>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {selectedBid?.end_date ? formatDateTime(selectedBid.end_date) : 'Not Specified'}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
                  <span className="text-xs text-muted-foreground">Estimated Bid Value</span>
                  <p className="text-sm font-bold text-foreground mt-1">
                    {selectedBid?.estimated_value ? formatCurrency(selectedBid.estimated_value) : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Slide-Over Right Drawer (Exact Real History & Live Chat) */}
            <div className="w-full md:w-[440px] bg-card border-t md:border-t-0 md:border-l border-border flex flex-col shadow-xl z-20 relative">
              {/* Drawer Header */}
              <div className="p-4 border-b border-border space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500"></span>
                    <h4 className="text-sm font-bold text-foreground">Tender Hub: {tenderBidNo}</h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Slide-Over Panel</span>
                </div>

                {/* Drawer Tabs */}
                <div className="flex rounded-lg bg-muted p-1 border border-border text-xs">
                  <button
                    onClick={() => setDrawerTab('chat')}
                    className={`flex-1 py-1.5 text-center transition-colors rounded-md ${drawerTab === 'chat'
                      ? 'font-semibold bg-teal-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground font-medium'
                      }`}
                  >
                    Team Chat ({chatMessages.length})
                  </button>
                  <button
                    onClick={() => setDrawerTab('history')}
                    className={`flex-1 py-1.5 text-center transition-colors rounded-md ${drawerTab === 'history'
                      ? 'font-semibold bg-teal-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground font-medium'
                      }`}
                  >
                    Audit Trail ({historyList.length})
                  </button>
                </div>
              </div>

              {/* Drawer Content: Real Chat */}
              {drawerTab === 'chat' && (
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/20 max-h-[380px]">
                  {chatMessages.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No messages in room yet.</p>
                  ) : (
                    chatMessages.map((m) => {
                      const sName = m.sender_name || m.sender || 'Member'
                      const sRole = m.sender_role || m.role || 'USER'
                      const timeStr = m.created_at ? formatDateTime(m.created_at) : m.time || 'Recently'
                      const isQ = m.message_type === 'QUESTION'

                      return (
                        <div key={m.id} className="bg-card p-3 rounded-xl border border-border space-y-1 shadow-xs">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span className="font-bold text-teal-600 dark:text-teal-400">
                              {sName} ({sRole})
                            </span>
                            <span>{timeStr}</span>
                          </div>
                          {isQ && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold inline-block">
                              Question
                            </span>
                          )}
                          <div className="text-xs text-foreground">
                            {renderMessageContent(m.content || m.text)}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* Drawer Content: History (EXACT REAL DATA) */}
              {drawerTab === 'history' && (
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-card max-h-[380px]">
                  {historyList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No audit history found.</p>
                  ) : (
                    historyList.map((h) => (
                      <div
                        key={h.id}
                        className={`text-xs border-l-2 pl-3 py-1 space-y-0.5 ${h.category === 'date'
                          ? 'border-amber-500'
                          : h.category === 'doc'
                            ? 'border-emerald-500'
                            : 'border-teal-500'
                          }`}
                      >
                        <p className="font-semibold text-foreground">
                          {h.category === 'date' ? 'Date Milestone Revision' : STAGE_LABELS[h.to_stage] || h.to_stage || 'Stage Progression'}
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{h.transition_reason}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateTime(h.created_at)} by {h.transitioned_by?.full_name || 'Team Member'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Drawer Footer */}
              <div className="p-3 border-t border-border bg-card space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={inputMessage3}
                    onChange={(e) => handleInputChange(3, e.target.value)}
                    placeholder={`Message in ${tenderBidNo}...`}
                    className="flex-1 text-xs h-9 bg-background"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handlePostMessage(3)
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={sendingChat || !inputMessage3.trim()}
                    onClick={() => handlePostMessage(3)}
                    className="h-9 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 4: Stepper Timeline & Mini-Dock (Real Stage Matrix)                */}
      {/* ========================================================================= */}
      {activeConcept === 'concept-4' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground shadow-sm">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-foreground">Exact Stage Matrix Stepper:</span>
              <span>
                Real progression mapping of all 10 stages for <strong className="text-foreground">{tenderBidNo}</strong> with real completions and timestamps.
              </span>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              Progression: {tenderStageLabel}
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 space-y-6 shadow-sm">
            {/* Visual Stepper */}
            <div>
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-foreground">Tender Progression Journey: {tenderBidNo}</span>
                <span className="text-teal-600 dark:text-teal-400">Current: {tenderStageLabel}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-1.5">
                {WORKFLOW_STAGES.map((s) => {
                  const isCompleted = selectedBid?.stage_completions?.[s.key]
                  const isCurrent = (selectedBid?.current_stage || selectedBid?.workflow_stage) === s.key

                  let stepClass = 'bg-muted/40 border-border text-muted-foreground'
                  if (isCompleted) {
                    stepClass = 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  } else if (isCurrent) {
                    stepClass = 'bg-teal-50 border-teal-400 dark:bg-teal-950/50 dark:border-teal-700 text-teal-800 dark:text-teal-200 ring-2 ring-teal-500/20'
                  }

                  return (
                    <div key={s.key} className={`p-2 rounded border text-center transition-all ${stepClass}`}>
                      <span className="text-[10px] font-bold block truncate">
                        {s.short} {isCompleted ? '✓' : isCurrent ? '●' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Stage Event Cards from EXACT real history */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Recorded Lifecycle Stage Milestones
              </h4>
              <div className="space-y-2">
                {historyList.filter((h) => h.category === 'stage').slice(0, 5).map((sh) => (
                  <div key={sh.id} className="border border-border rounded-xl bg-card p-3.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>{STAGE_LABELS[sh.to_stage] || sh.to_stage || 'Stage Progression'}</span>
                        <span className="px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[10px] text-teal-700 dark:bg-teal-950/50 dark:border-teal-800 dark:text-teal-300">
                          Recorded
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(sh.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{sh.transition_reason}</p>
                    <p className="text-[11px] text-muted-foreground">
                      By: <strong className="text-foreground">{sh.transitioned_by?.full_name || 'Team Member'}</strong>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating Bottom Mini-Chat Strip connected to real chat */}
            <div className="border border-teal-200 bg-teal-50/50 dark:bg-teal-950/30 dark:border-teal-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2 text-xs truncate">
                <span className="size-2 rounded-full bg-teal-500 shrink-0"></span>
                <span className="font-bold text-foreground shrink-0">Latest Discussion:</span>
                <span className="text-muted-foreground truncate">
                  {chatMessages[chatMessages.length - 1]?.content || chatMessages[chatMessages.length - 1]?.text || 'No chat messages yet in room'}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => setActiveConcept('concept-1')}
                className="h-8 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shrink-0 shadow-xs"
              >
                Open Full Chat Hub
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Comparison Matrix & Recommendation                                       */}
      {/* ========================================================================= */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <History className="size-4 text-teal-600 dark:text-teal-400" />
          <span>Design Concepts Comparison & Recommendation</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2.5 px-3 font-semibold">Concept</th>
                <th className="py-2.5 px-3 font-semibold">Layout Structure</th>
                <th className="py-2.5 px-3 font-semibold">Pros</th>
                <th className="py-2.5 px-3 font-semibold">Best Suited For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-muted-foreground">
              <tr className="hover:bg-muted/30">
                <td className="py-2.5 px-3 font-bold text-teal-700 dark:text-teal-400">1. Split-Screen Hub</td>
                <td className="py-2.5 px-3">60% Audit Timeline | 40% Live Team Chat</td>
                <td className="py-2.5 px-3">Clear separation; simultaneously read history while typing messages.</td>
                <td className="py-2.5 px-3 font-semibold text-foreground">Daily operations, BE & AM collaboration (Recommended)</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-2.5 px-3 font-bold text-sky-700 dark:text-sky-400">2. Omnichannel Stream</td>
                <td className="py-2.5 px-3">Single unified feed with category filter tabs</td>
                <td className="py-2.5 px-3">Chronological context; see comments right next to stage transitions.</td>
                <td className="py-2.5 px-3 font-semibold text-foreground">Auditing & post-mortem review</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-2.5 px-3 font-bold text-violet-700 dark:text-violet-400">3. Slide-Over Drawer</td>
                <td className="py-2.5 px-3">Right contextual slide-in drawer with tab switch</td>
                <td className="py-2.5 px-3">Zero page switching; accessible from any stage workspace.</td>
                <td className="py-2.5 px-3 font-semibold text-foreground">Quick in-flight updates during stage work</td>
              </tr>
              <tr className="hover:bg-muted/30">
                <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400">4. Stepper & Mini-Dock</td>
                <td className="py-2.5 px-3">Horizontal visual stage stepper + docked chat bar</td>
                <td className="py-2.5 px-3">High-level management overview with instant expandable chat.</td>
                <td className="py-2.5 px-3 font-semibold text-foreground">Management & reporting managers</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Dynamic Floating Action Button for Concept 1 when chat is closed */}
      {activeConcept === 'concept-1' && !isChatWindowOpen && (
        <div className="fixed bottom-6 right-6 z-40 animate-in fade-in zoom-in duration-200">
          <button
            type="button"
            onClick={() => setIsChatWindowOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs shadow-xl transition-all hover:scale-105 active:scale-95 group border border-teal-400/30"
            title="Open Dynamic Tender Chat Window"
          >
            <MessagesSquare className="size-4 group-hover:rotate-6 transition-transform" />
            <span>Open Tender Chat</span>
            {chatMessages.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white text-teal-800 text-[10px] font-bold">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
