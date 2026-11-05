CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE boat_status AS ENUM ('active', 'inactive');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE boat_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(320) NOT NULL UNIQUE,
  phone varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE boats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number varchar(30) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  passenger_capacity integer NOT NULL CHECK (passenger_capacity BETWEEN 1 AND 200),
  coverage_zone varchar(120) NOT NULL,
  status boat_status NOT NULL DEFAULT 'active',
  verification_status verification_status NOT NULL DEFAULT 'pending',
  owner_id uuid NOT NULL REFERENCES boat_owners(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
