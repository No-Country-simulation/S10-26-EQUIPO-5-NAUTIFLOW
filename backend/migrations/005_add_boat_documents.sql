CREATE TABLE IF NOT EXISTS boat_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boat_id uuid NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
  type varchar(30) NOT NULL CHECK (type IN ('license', 'insurance', 'criminalRecord')),
  file_url text NOT NULL,
  file_public_id text NOT NULL,
  original_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  verification_status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_boat_documents_boat_type UNIQUE (boat_id, type)
);

CREATE INDEX IF NOT EXISTS idx_boat_documents_boat_id ON boat_documents (boat_id);
