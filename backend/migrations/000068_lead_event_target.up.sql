-- Migration 000068: who a lead timeline step was handed to.
--
-- A prebid handoff has a "from" (the actor) and a "to" (the person the sheet went to). Until now the
-- recipient's name was written into the note; it is now its own column, so the note holds only what
-- the person typed and the page can show "from -> to" as cards.
ALTER TABLE leads.lead_events
    ADD COLUMN IF NOT EXISTS target_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
