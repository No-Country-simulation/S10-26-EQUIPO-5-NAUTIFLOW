CREATE TABLE IF NOT EXISTS boat_availability_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_boat_availability_window_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_boat_availability_windows_boat_time
  ON boat_availability_windows (boat_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS empty_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  origin varchar(120) NOT NULL,
  destination varchar(120) NOT NULL,
  returns_at timestamptz NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empty_legs_returns_at
  ON empty_legs (returns_at);

CREATE TABLE IF NOT EXISTS owner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_id uuid NOT NULL UNIQUE REFERENCES boat_feedback(id) ON DELETE CASCADE,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_notifications_owner_created
  ON owner_notifications (owner_id, created_at DESC);
