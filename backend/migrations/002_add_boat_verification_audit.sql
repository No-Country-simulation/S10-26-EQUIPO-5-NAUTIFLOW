ALTER TABLE boats
  ADD COLUMN verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN verification_reason text,
  ADD COLUMN verified_at timestamptz;
