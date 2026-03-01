CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_text TEXT,
  metrics_label TEXT,
  clarifications_json TEXT NOT NULL,
  activity_json TEXT NOT NULL,
  awaiting_note TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
