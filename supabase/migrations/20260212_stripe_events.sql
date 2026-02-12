-- Stripe webhook idempotency table
CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast lookups
CREATE INDEX idx_stripe_events_event_id ON stripe_events (event_id);
