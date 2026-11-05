ALTER TABLE boats
  ADD COLUMN IF NOT EXISTS documented_passenger_capacity integer
  CHECK (
    documented_passenger_capacity IS NULL
    OR documented_passenger_capacity BETWEEN 1 AND 200
  );
