# Original FastAPI reservation reference subset

Copied from the earlier user-supplied archive `ai-synergy-5(3).zip`. This is reference material, not the runtime used by the standalone Render MVP. It intentionally excludes `.git`, virtual environments, local databases, secrets, unrelated frontend dependencies and generated files.

Included files:

- `khadsetu/backend/app/services/reservation.py`
- `khadsetu/backend/app/services/state_machine.py`
- `khadsetu/backend/app/routes/requests.py`
- `khadsetu/backend/app/routes/tokens.py`
- `khadsetu/backend/app/routes/inventory.py`
- `khadsetu/backend/app/database.py` and `models.py`
- `khadsetu/backend/tests/test_reservation.py` and `test_database.py`

These files define the original design for full-quantity stock reservations, FIFO waiting, token transitions, expiry, OTP redemption and inventory changes. The standalone Next.js implementation has been adapted to a JSON single-instance demo store. For production, retain the SQL transactional/locking approach rather than treating the JSON store as a production database.

The supplied archive did not contain a backend-level `requirements.txt` at the referenced path, so this subset does not invent dependency pins.
