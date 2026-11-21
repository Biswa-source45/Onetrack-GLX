-- Migration 000073: Dedicated Chat Module for Tenders with Team Mentions
CREATE TABLE IF NOT EXISTS bid.tender_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bid_id UUID NOT NULL REFERENCES bid.bid_workspaces(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'CHAT',
    mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tender_chat_messages_bid_id ON bid.tender_chat_messages(bid_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_tender_chat_messages_sender_id ON bid.tender_chat_messages(sender_id);
