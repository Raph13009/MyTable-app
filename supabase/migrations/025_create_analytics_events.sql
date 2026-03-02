-- Table analytics_events pour le tracking produit (analytics-pro)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role TEXT,
  event_type TEXT NOT NULL,
  page TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_event_type ON analytics_events (event_type, created_at DESC);
CREATE INDEX idx_analytics_events_user_id ON analytics_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analytics_events_created_at ON analytics_events (created_at DESC);

-- RLS: insert via API (service role), pas de lecture publique
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON analytics_events FOR ALL USING (false);
