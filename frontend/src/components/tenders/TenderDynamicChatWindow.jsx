import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Send,
  MessagesSquare,
  MessageSquare,
  Sparkles,
  HelpCircle,
  AtSign,
  Users,
  X,
  Loader2,
  RefreshCw,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getTenderChatMessages, sendTenderChatMessage, getTenderChatMembers } from '../../services/chat'
import { isStageAfterStage5 } from '../../services/bids'
import { formatDateTime } from '../../lib/tenderFormat'
import { renderMentions, teamMemberCount } from '../../lib/chatMentions'

export function TenderDynamicChatWindow({ bid, bidId, onClose, className = '' }) {
  const currentBidId = bidId || bid?.id || ''
  const tenderBidNo = bid?.bid_no || bid?.gem_bid_no || 'Tender Room'
  const tenderStage = bid?.current_stage || bid?.workflow_stage || 'DISCOVERED'
  const isPostStage5 = isStageAfterStage5(tenderStage)

  const [chatMessages, setChatMessages] = useState([])
  const [loadingChat, setLoadingChat] = useState(false)
  const [sendingChat, setSendingChat] = useState(false)
  const [eligibleMembers, setEligibleMembers] = useState([])

  const [inputMessage, setInputMessage] = useState('')
  const [isQuestionMode, setIsQuestionMode] = useState(false)
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')

  const messagesEndRef = useRef(null)

  // 1. Fetch messages and members from backend
  const loadChat = async (targetId, withMembers = true) => {
    if (!targetId) return
    try {
      const [chatRes, membersRes] = await Promise.all([
        getTenderChatMessages(targetId),
        withMembers ? getTenderChatMembers(targetId) : Promise.resolve(null),
      ])
      if (chatRes.ok && Array.isArray(chatRes.data)) {
        setChatMessages(chatRes.data)
      }
      if (membersRes?.ok && Array.isArray(membersRes.data)) {
        setEligibleMembers(membersRes.data)
      }
    } catch (err) {
      console.error('Failed to load chat:', err)
    }
  }

  useEffect(() => {
    if (!currentBidId) return
    setLoadingChat(true)
    loadChat(currentBidId).finally(() => setLoadingChat(false))

    // Poll messages only (members rarely change) and not while the tab is hidden
    const interval = setInterval(() => {
      if (!document.hidden) loadChat(currentBidId, false)
    }, 4000)

    return () => clearInterval(interval)
  }, [currentBidId])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  // Mention filtering
  const filteredMembers = useMemo(() => {
    if (!mentionFilter) return eligibleMembers
    const q = mentionFilter.toLowerCase()
    return eligibleMembers.filter(
      (m) =>
        (m.full_name && m.full_name.toLowerCase().includes(q)) ||
        (m.username && m.username.toLowerCase().includes(q))
    )
  }, [eligibleMembers, mentionFilter])

  // Input typing with @ mention trigger
  const handleInputChange = (value) => {
    setInputMessage(value)
    const lastWord = value.split(/\s+/).pop() || ''
    if (lastWord.startsWith('@')) {
      setMentionFilter(lastWord.slice(1))
      setShowMentionMenu(true)
    } else {
      setShowMentionMenu(false)
    }
  }

  // Insert mention into text
  const insertMention = (member) => {
    const isGroup = member.id === 'everyone' || member.id === 'all'
    const mentionToken = isGroup ? `@${member.id} ` : `@${member.full_name} `
    setInputMessage((prev) => {
      const atIdx = prev.lastIndexOf('@')
      if (atIdx >= 0) {
        return prev.slice(0, atIdx) + mentionToken
      }
      return prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + mentionToken
    })
    setShowMentionMenu(false)
  }

  // Post message to backend
  const handlePostMessage = async () => {
    const text = inputMessage.trim()
    if (!text || !currentBidId || sendingChat) return

    setSendingChat(true)
    try {

      const payload = {
        content: text,
        message_type: isQuestionMode ? 'QUESTION' : text.endsWith('?') ? 'QUESTION' : 'CHAT',
        attachments: [],
      }

      const res = await sendTenderChatMessage(currentBidId, payload)
      if (res.ok && res.data) {
        setChatMessages((prev) => [...prev, res.data])
        setInputMessage('')
        setIsQuestionMode(false)
        setShowMentionMenu(false)
      } else {
        toast.error(res.message || 'Failed to post message')
      }
    } catch {
      toast.error('Network error posting message')
    } finally {
      setSendingChat(false)
    }
  }

  // Role styling helper
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

  const renderMessageContent = (content) => renderMentions(content, eligibleMembers)

  return (
    <div className={`bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm relative ${className}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-border bg-muted/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950 dark:border-teal-800 shrink-0">
            <MessagesSquare className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-foreground truncate flex items-center gap-1.5">
              <span>Tender Discussion</span>
              <span className="text-muted-foreground font-normal text-xs truncate">| {tenderBidNo}</span>
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <span className="truncate">Live Sync · {teamMemberCount(eligibleMembers)} Members</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => loadChat(currentBidId)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh Messages"
          >
            <RefreshCw className="size-3.5" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
              title="Close Chat Window"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="p-3.5 overflow-y-auto space-y-3 max-h-[460px] flex-1 bg-card">
        {loadingChat && chatMessages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin text-teal-600" />
            <span className="text-xs">Loading tender messages…</span>
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-1">
            <MessageSquare className="size-6 mx-auto text-muted-foreground/60" />
            <p className="text-xs font-semibold">No messages yet in this room</p>
            <p className="text-[11px]">Type below to start the conversation or ask a question with @mentions.</p>
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
                  className={`size-7 rounded-full border text-xs font-bold flex items-center justify-center shrink-0 ${
                    isAnnouncement
                      ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-200'
                      : isQuestion
                      ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-primary/10 border-primary/20 text-primary'
                  }`}
                >
                  {isAnnouncement ? <Sparkles className="size-3.5" /> : senderName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{senderName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border ${getRoleBadgeClass(senderRole)}`}>
                      {senderRole}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                  </div>

                  <div
                    className={`rounded-xl rounded-tl-none p-3 text-xs border leading-relaxed ${
                      isAnnouncement
                        ? 'bg-blue-50/80 border-blue-200 text-blue-950 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-100'
                        : isQuestion
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100'
                        : 'bg-muted/60 border-border text-foreground'
                    }`}
                  >
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
        <div ref={messagesEndRef} />
      </div>

      {/* Mention Popup Menu */}
      {showMentionMenu && (
        <div className="absolute bottom-16 left-3 right-3 bg-popover border border-border rounded-xl shadow-2xl p-2 z-50 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
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
          <div className="max-h-44 overflow-y-auto space-y-0.5">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No matching colleagues found</div>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        member.id === 'everyone' || member.id === 'all'
                          ? 'bg-amber-100 text-amber-800'
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

      {/* Input Composer */}
      <div className="p-3 border-t border-border bg-muted/40 space-y-2">
        {isQuestionMode && (
          <div className="flex items-center justify-between px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800">
            <span className="flex items-center gap-1 font-semibold text-[11px]">
              <HelpCircle className="size-3 text-amber-600" />
              Inquiry Mode: Asking a question about this tender
            </span>
            <button
              onClick={() => setIsQuestionMode(false)}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
            >
              <X className="size-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={inputMessage}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={
              isQuestionMode
                ? `Ask a question about ${tenderBidNo} (e.g. Can @everyone confirm specs?)...`
                : `Type message or @ to mention colleagues...`
            }
            className={`flex-1 bg-background text-xs h-9 ${
              isQuestionMode ? 'border-amber-400 focus:ring-amber-400' : ''
            }`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handlePostMessage()
              }
            }}
          />
          <Button
            size="sm"
            disabled={sendingChat || !inputMessage.trim()}
            onClick={handlePostMessage}
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
              className={`flex items-center gap-1 font-medium transition-colors ${
                isQuestionMode ? 'text-amber-600 font-bold' : 'hover:text-foreground'
              }`}
            >
              <HelpCircle className="size-3.5 text-amber-600" />
              <span>{isQuestionMode ? 'Question (On)' : 'Ask Question'}</span>
            </button>

            <button
              type="button"
              onClick={() => insertMention({ id: 'all', full_name: 'all' })}
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
          <span className="hidden sm:inline-block text-[10px]">Press Enter to send</span>
        </div>
      </div>
    </div>
  )
}
