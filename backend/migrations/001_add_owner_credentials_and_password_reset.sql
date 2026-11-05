ALTER TABLE boat_owners RENAME TO users;

ALTER TABLE users
  ADD COLUMN password_hash varchar(200),
  ADD COLUMN role varchar(30) NOT NULL DEFAULT 'owner';

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IDX_password_reset_tokens_expires_at
  ON password_reset_tokens(expires_at);