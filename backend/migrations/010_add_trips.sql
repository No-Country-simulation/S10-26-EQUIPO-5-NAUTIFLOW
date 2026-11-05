CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE
    REFERENCES boat_bookings(id) ON DELETE CASCADE,
  origin varchar(120) NOT NULL,
  destination varchar(120) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_trips_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_trips_starts_at
  ON trips (starts_at);
