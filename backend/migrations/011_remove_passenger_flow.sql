BEGIN;

ALTER TABLE boat_feedback
  DROP CONSTRAINT IF EXISTS boat_feedback_booking_id_fkey,
  DROP CONSTRAINT IF EXISTS boat_feedback_booking_id_key,
  DROP CONSTRAINT IF EXISTS "UQ_boat_feedback_booking",
  DROP CONSTRAINT IF EXISTS boat_feedback_passenger_id_fkey;

ALTER TABLE boat_feedback
  DROP COLUMN IF EXISTS booking_id,
  DROP COLUMN IF EXISTS passenger_id,
  ADD COLUMN IF NOT EXISTS trip_id uuid;

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS boat_id uuid,
  ADD COLUMN IF NOT EXISTS empty_leg_id uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_token_hash varchar(64),
  ADD COLUMN IF NOT EXISTS review_token_expires_at timestamptz;

DO $$
BEGIN
  IF to_regclass('public.boat_bookings') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'trips'
         AND column_name = 'booking_id'
     ) THEN
    UPDATE trips AS trip
    SET boat_id = booking.boat_id
    FROM boat_bookings AS booking
    WHERE trip.booking_id = booking.id
      AND trip.boat_id IS NULL;
  END IF;
END $$;

ALTER TABLE trips
  DROP CONSTRAINT IF EXISTS trips_booking_id_fkey,
  DROP CONSTRAINT IF EXISTS trips_booking_id_key,
  DROP CONSTRAINT IF EXISTS "UQ_trips_booking_id",
  DROP CONSTRAINT IF EXISTS chk_trips_time_order,
  DROP CONSTRAINT IF EXISTS "CHK_trips_time_order",
  DROP COLUMN IF EXISTS booking_id,
  ALTER COLUMN boat_id SET NOT NULL,
  ALTER COLUMN ends_at DROP NOT NULL;

ALTER TABLE trips
  DROP CONSTRAINT IF EXISTS fk_trips_boat,
  DROP CONSTRAINT IF EXISTS fk_trips_empty_leg,
  DROP CONSTRAINT IF EXISTS chk_trips_time_order,
  DROP CONSTRAINT IF EXISTS "CHK_trips_time_order";

ALTER TABLE trips
  ADD CONSTRAINT fk_trips_boat
    FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_trips_empty_leg
    FOREIGN KEY (empty_leg_id) REFERENCES empty_legs(id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_trips_time_order
    CHECK (ends_at IS NULL OR ends_at > starts_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_empty_leg_id
  ON trips (empty_leg_id)
  WHERE empty_leg_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_review_token_hash
  ON trips (review_token_hash)
  WHERE review_token_hash IS NOT NULL;

ALTER TABLE boat_feedback
  DROP CONSTRAINT IF EXISTS fk_boat_feedback_trip;

ALTER TABLE boat_feedback
  ADD CONSTRAINT fk_boat_feedback_trip
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_boat_feedback_trip_id
  ON boat_feedback (trip_id)
  WHERE trip_id IS NOT NULL;

DROP TABLE IF EXISTS boat_bookings;

DELETE FROM users
WHERE role = 'passenger';

UPDATE boats
SET available_passenger_capacity = passenger_capacity;

COMMIT;
