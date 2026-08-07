import React, { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, CheckCheck, FileText, AlertCircle, Info, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAlerts, markAlertRead, markAllAlertsRead } from '../../services/alerts'

export function AlertsPage() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const { refreshAlertsCount } = useOutletContext() || {}

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await getAlerts()
      if (res.ok) {
        setAlerts(res.data || [])
        refreshAlertsCount?.()
      }
    } catch {
      toast.error('Failed to load system alerts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const handleMarkRead = async (id) => {
    try {
      const res = await markAlertRead(id)
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)))
        refreshAlertsCount?.()
      }
    } catch {
      toast.error('Failed to update alert status')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      const res = await markAllAlertsRead()
      if (res.ok) {
        setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })))
        refreshAlertsCount?.()
        toast.success('All alerts marked as read')
      }
    } catch {
      toast.error('Failed to mark all as read')
    }
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length

  const getAlertIcon = (type) => {
    switch (type) {
      case 'ELIGIBILITY':
        return <AlertCircle className="size-4 text-amber-500" />
      case 'EMD':
        return <ShieldAlert className="size-4 text-purple-500" />
      case 'APPROVAL':
        return <FileText className="size-4 text-blue-500" />
      case 'WIN':
        return <CheckCircle2 className="size-4 text-emerald-500" />
      default:
        return <Info className="size-4 text-slate-500" />
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">System Alerts & Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full px-2">
                {unreadCount} New
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time notifications for tender eligibility, EMD processing, internal approvals, and win alerts.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2">
            <CheckCheck className="size-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading notifications...</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card">
          <Bell className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-heading text-base font-semibold">No Alerts Available</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
            You will receive instant alerts here when tenders require your attention or status updates occur.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, index) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`rounded-xl border p-4 transition-all ${
                !alert.is_read
                  ? 'bg-card border-primary/30 shadow-xs ring-1 ring-primary/10'
                  : 'bg-card/50 border-border opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-foreground">{alert.title}</h4>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {alert.type}
                      </Badge>
                      {!alert.is_read && (
                        <span className="size-2 rounded-full bg-primary" title="Unread notification" />
                      )}
                    </div>
                    {alert.message?.includes('<') ? (
                      <div 
                        className="text-sm text-foreground leading-relaxed overflow-x-auto my-1" 
                        dangerouslySetInnerHTML={{ __html: alert.message }} 
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{alert.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground/70 font-mono pt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!alert.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(alert.id)}
                    className="text-xs shrink-0"
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
