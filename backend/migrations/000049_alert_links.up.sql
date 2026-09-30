-- Deep link for an alert (in-app click + email button): which tender page,
-- tab and stage the notification is actually about, instead of every alert
-- dropping the user on the tender's Overview.
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS link TEXT;

-- Backfill existing tender alerts from their type/title, matching the links
-- new alerts are now created with.
UPDATE public.alerts
SET link = '/dashboard/tenders/' || bid_id::text || CASE
    WHEN type LIKE 'STAGE\_TRANSITION\_%' THEN '?tab=stages&stage=' || substr(type, 18)
    WHEN type LIKE 'TENDER\_%\_PENDING\_APPROVAL' THEN '?approval=1'
    WHEN type = 'INTERNAL_APPROVAL_READY' OR title ILIKE '%Internal Approval%' THEN '?tab=stages&stage=INTERNAL_APPROVAL'
    WHEN title ILIKE '%Pricing Approv%' THEN '?tab=stages&stage=PRICING_REQUEST'
    WHEN title ILIKE '%EMD Processing Required%' OR title ILIKE 'EMD Ready%' THEN '?tab=stages&stage=EMD_PROCESSING'
    WHEN title ILIKE 'Ready for Primary Review%' OR title ILIKE 'Primary Review Complete%' OR title ILIKE 'Tender Approved%' THEN '?tab=stages&stage=PRIMARY_REVIEW'
    ELSE ''
END
WHERE link IS NULL AND bid_id IS NOT NULL;
