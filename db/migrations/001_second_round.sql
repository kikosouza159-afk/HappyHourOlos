-- AFTERHOURS v2: preserve the existing public.afterhours_votes (round 1).
-- Apply to neondb, public schema. The Node service also runs these idempotently on boot.
CREATE TABLE IF NOT EXISTS public.afterhours_final_votes (
  voter_hash CHAR(64) NOT NULL,
  category VARCHAR(16) NOT NULL CHECK (category IN ('bars','burgers')),
  venue_id VARCHAR(70) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (voter_hash, category)
);
CREATE TABLE IF NOT EXISTS public.afterhours_election_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_round SMALLINT NOT NULL DEFAULT 1 CHECK (current_round IN (1,2)),
  phase VARCHAR(12) NOT NULL DEFAULT 'open' CHECK (phase IN ('open','closed')),
  bars_finalists VARCHAR(70)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(70)[],
  burgers_finalists VARCHAR(70)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(70)[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.afterhours_election_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
