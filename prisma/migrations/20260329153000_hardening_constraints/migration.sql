ALTER TABLE "Table"
  ADD CONSTRAINT "table_capacity_bounds_check"
  CHECK (
    "capacityMax" >= 1
    AND ("capacityMin" IS NULL OR ("capacityMin" >= 1 AND "capacityMin" <= "capacityMax"))
  );

ALTER TABLE "Reservation"
  ADD CONSTRAINT "reservation_time_window_check"
  CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT "reservation_party_size_check"
  CHECK ("partySize" >= 1);

ALTER TABLE "TableBlock"
  ADD CONSTRAINT "table_block_window_check"
  CHECK ("endsAt" > "startsAt");
