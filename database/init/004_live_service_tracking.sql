-- Swiggy-style service tracking fields. Existing bookings and payments are preserved.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_photo_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_per_booking
  ON payments (booking_id);
