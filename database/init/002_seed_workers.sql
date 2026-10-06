INSERT INTO users (
  id,
  name,
  email,
  phone,
  password_hash,
  role
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Rahul Kumar',
    'rahul.plumber@proxifix.local',
    '+919900000001',
    crypt('Worker@123', gen_salt('bf', 12)),
    'WORKER'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Amit Sharma',
    'amit.plumber@proxifix.local',
    '+919900000002',
    crypt('Worker@123', gen_salt('bf', 12)),
    'WORKER'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Priya Verma',
    'priya.electrician@proxifix.local',
    '+919900000003',
    crypt('Worker@123', gen_salt('bf', 12)),
    'WORKER'
  )
ON CONFLICT (email) DO NOTHING;

INSERT INTO workers (
  user_id,
  description,
  experience_years,
  verification_status,
  average_rating,
  total_reviews,
  online_status,
  availability_status,
  current_location,
  address,
  city,
  state,
  postal_code,
  last_location_updated_at
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Experienced plumber for leaks, fittings, and pipe repairs.',
    8,
    'APPROVED',
    4.8,
    96,
    TRUE,
    'AVAILABLE',
    ST_SetSRID(ST_MakePoint(77.4126, 23.2662), 4326)::geography,
    'MP Nagar',
    'Bhopal',
    'Madhya Pradesh',
    '462011',
    NOW()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Home plumbing specialist for taps, drains, and water tanks.',
    5,
    'APPROVED',
    4.5,
    42,
    TRUE,
    'AVAILABLE',
    ST_SetSRID(ST_MakePoint(77.3975, 23.2514), 4326)::geography,
    'New Market',
    'Bhopal',
    'Madhya Pradesh',
    '462003',
    NOW()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Certified electrician for home electrical maintenance.',
    6,
    'APPROVED',
    4.9,
    121,
    TRUE,
    'AVAILABLE',
    ST_SetSRID(ST_MakePoint(77.4304, 23.2408), 4326)::geography,
    'Arera Colony',
    'Bhopal',
    'Madhya Pradesh',
    '462016',
    NOW()
  )
ON CONFLICT (user_id) DO UPDATE
SET
  verification_status = EXCLUDED.verification_status,
  online_status = EXCLUDED.online_status,
  availability_status = EXCLUDED.availability_status,
  current_location = EXCLUDED.current_location,
  last_location_updated_at = NOW();

INSERT INTO worker_services (
  worker_id,
  service_category_id,
  minimum_charge,
  experience_years
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  id,
  299,
  8
FROM service_categories
WHERE name = 'Plumber'
ON CONFLICT (worker_id, service_category_id) DO NOTHING;

INSERT INTO worker_services (
  worker_id,
  service_category_id,
  minimum_charge,
  experience_years
)
SELECT
  '22222222-2222-2222-2222-222222222222',
  id,
  249,
  5
FROM service_categories
WHERE name = 'Plumber'
ON CONFLICT (worker_id, service_category_id) DO NOTHING;

INSERT INTO worker_services (
  worker_id,
  service_category_id,
  minimum_charge,
  experience_years
)
SELECT
  '33333333-3333-3333-3333-333333333333',
  id,
  349,
  6
FROM service_categories
WHERE name = 'Electrician'
ON CONFLICT (worker_id, service_category_id) DO NOTHING;