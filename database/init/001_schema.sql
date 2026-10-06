CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('CUSTOMER', 'WORKER', 'ADMIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE verification_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE availability_status AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE booking_status AS ENUM (
    'PENDING',
    'ACCEPTED',
    'ARRIVING',
    'STARTED',
    'COMPLETED',
    'CANCELLED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE payment_status AS ENUM (
    'PENDING',
    'PAID',
    'FAILED',
    'REFUNDED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(25) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_location GEOGRAPHY(POINT, 4326),
  address TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  postal_code VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workers (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_photo_url TEXT,
  description TEXT,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  verification_status verification_status NOT NULL DEFAULT 'PENDING',
  average_rating NUMERIC(2, 1) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  total_reviews INTEGER NOT NULL DEFAULT 0 CHECK (total_reviews >= 0),
  online_status BOOLEAN NOT NULL DEFAULT FALSE,
  availability_status availability_status NOT NULL DEFAULT 'OFFLINE',
  current_location GEOGRAPHY(POINT, 4326),
  address TEXT,
  city VARCHAR(120),
  state VARCHAR(120),
  postal_code VARCHAR(20),
  last_location_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS worker_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(user_id) ON DELETE CASCADE,
  service_category_id UUID NOT NULL REFERENCES service_categories(id),
  minimum_charge NUMERIC(10, 2) NOT NULL CHECK (minimum_charge >= 0),
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(worker_id, service_category_id)
);

CREATE TABLE IF NOT EXISTS worker_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES workers(user_id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy_meters NUMERIC(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(user_id),
  worker_id UUID NOT NULL REFERENCES workers(user_id),
  worker_service_id UUID NOT NULL REFERENCES worker_services(id),

  customer_location GEOGRAPHY(POINT, 4326) NOT NULL,
  worker_location GEOGRAPHY(POINT, 4326),

  customer_address TEXT NOT NULL,
  service_description TEXT NOT NULL,
  booking_status booking_status NOT NULL DEFAULT 'PENDING',

  scheduled_time TIMESTAMPTZ,
  estimated_price NUMERIC(10, 2) NOT NULL CHECK (estimated_price >= 0),
  final_price NUMERIC(10, 2) CHECK (final_price >= 0),

  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  completion_photo_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(user_id),
  worker_id UUID NOT NULL REFERENCES workers(user_id),
  rating NUMERIC(2, 1) NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  payment_method VARCHAR(50),
  provider_reference VARCHAR(255) UNIQUE,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_location
  ON customers USING GIST (current_location);

CREATE INDEX IF NOT EXISTS idx_workers_location
  ON workers USING GIST (current_location);

CREATE INDEX IF NOT EXISTS idx_workers_search
  ON workers (verification_status, online_status, availability_status);

CREATE INDEX IF NOT EXISTS idx_worker_services_category
  ON worker_services (service_category_id, worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_locations_geo
  ON worker_locations USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_bookings_customer
  ON bookings (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_worker
  ON bookings (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status
  ON bookings (booking_status);

CREATE INDEX IF NOT EXISTS idx_reviews_worker
  ON reviews (worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, is_read, created_at DESC);

INSERT INTO service_categories (name, description, icon)
VALUES
  ('Plumber', 'Leaks, taps, pipes, and fittings', '🔧'),
  ('Electrician', 'Wiring, switches, and repairs', '⚡'),
  ('Carpenter', 'Furniture and home repairs', '🪚'),
  ('Cleaner', 'Home and office cleaning', '🧹'),
  ('AC Repair', 'AC service and repair', '❄️'),
  ('Painter', 'Interior and exterior painting', '🎨'),
  ('Mechanic', 'Vehicle repair and maintenance', '🔩'),
  ('Appliance Repair', 'Home appliance repair', '🛠️')
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS workers_set_updated_at ON workers;
CREATE TRIGGER workers_set_updated_at
BEFORE UPDATE ON workers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS bookings_set_updated_at ON bookings;
CREATE TRIGGER bookings_set_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
