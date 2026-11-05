ALTER TABLE boats
  ADD COLUMN IF NOT EXISTS available_passenger_capacity integer;

UPDATE boats
SET available_passenger_capacity = passenger_capacity
WHERE available_passenger_capacity IS NULL;

ALTER TABLE boats
  ALTER COLUMN available_passenger_capacity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CHK_boats_available_passenger_capacity'
  ) THEN
    ALTER TABLE boats
      ADD CONSTRAINT "CHK_boats_available_passenger_capacity"
      CHECK (
        available_passenger_capacity >= 0
        AND available_passenger_capacity <= passenger_capacity
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_normalized
  ON users (lower(email));

CREATE TABLE IF NOT EXISTS boat_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_boat_bookings_passenger_boat UNIQUE (passenger_id, boat_id)
);

CREATE INDEX IF NOT EXISTS idx_boat_bookings_passenger_id
  ON boat_bookings (passenger_id);

CREATE TABLE IF NOT EXISTS boat_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES boat_bookings(id) ON DELETE CASCADE,
  boat_id uuid NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boat_feedback_boat_id
  ON boat_feedback (boat_id);