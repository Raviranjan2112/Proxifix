-- Allow customers to leave whole-star or half-star ratings, such as 4.5.
-- Existing whole-number ratings are preserved by the explicit numeric cast.
ALTER TABLE reviews
  ALTER COLUMN rating TYPE NUMERIC(2, 1)
  USING rating::numeric;
